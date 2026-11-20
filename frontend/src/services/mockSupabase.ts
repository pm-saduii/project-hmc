import { mockSeedData } from './mockData';

const STORAGE_KEY = 'projectms-mock-database-v1';
type Row = Record<string, any>;
type Filter = { column: string; operator: 'eq' | 'neq' | 'ilike' | 'in' | 'gte' | 'lte'; value: any };
type QueryResult = { data: any; error: null; count?: number };

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function readDatabase(): Record<string, Row[]> {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved) as Record<string, Row[]>;
  } catch (error) {
    console.warn('Unable to read local mock data; restoring the sample data.', error);
  }
  return clone(mockSeedData);
}

let database = readDatabase();

function persistDatabase(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(database));
  } catch (error) {
    console.warn('Unable to persist mock data in this browser.', error);
  }
}

let generatedId = 0;
const newId = (table: string) => `demo-${table}-${Date.now().toString(36)}-${(++generatedId).toString(36)}`;
const now = () => new Date().toISOString();

class MockQuery implements PromiseLike<QueryResult> {
  private operation: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private payload: Row | Row[] = {};
  private filters: Filter[] = [];
  private orders: Array<{ column: string; ascending: boolean; nullsFirst?: boolean }> = [];
  private maximumRows: number | null = null;
  private conflictColumns: string[] = [];
  private projection = '*';
  private returning = false;
  private cardinality: 'many' | 'single' | 'maybeSingle' = 'many';
  private execution: Promise<QueryResult> | null = null;

  constructor(private readonly table: string) {}

  select(columns = '*', _options?: Record<string, unknown>): this {
    this.projection = columns;
    if (this.operation !== 'select') this.returning = true;
    return this;
  }

  insert(values: Row | Row[]): this {
    this.operation = 'insert';
    this.payload = values;
    return this;
  }

  update(values: Row): this {
    this.operation = 'update';
    this.payload = values;
    return this;
  }

  delete(): this {
    this.operation = 'delete';
    return this;
  }

  upsert(values: Row | Row[], options?: { onConflict?: string }): this {
    this.operation = 'upsert';
    this.payload = values;
    this.conflictColumns = String(options?.onConflict || 'id').split(',').map((column) => column.trim());
    return this;
  }

  eq(column: string, value: any): this { return this.addFilter(column, 'eq', value); }
  neq(column: string, value: any): this { return this.addFilter(column, 'neq', value); }
  ilike(column: string, value: any): this { return this.addFilter(column, 'ilike', value); }
  in(column: string, value: any[]): this { return this.addFilter(column, 'in', value); }
  gte(column: string, value: any): this { return this.addFilter(column, 'gte', value); }
  lte(column: string, value: any): this { return this.addFilter(column, 'lte', value); }

  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): this {
    this.orders.push({ column: column.replace(/"/g, ''), ascending: options?.ascending !== false, nullsFirst: options?.nullsFirst });
    return this;
  }

  limit(count: number): this {
    this.maximumRows = count;
    return this;
  }

  single(): this { this.cardinality = 'single'; return this; }
  maybeSingle(): this { this.cardinality = 'maybeSingle'; return this; }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    this.execution ||= Promise.resolve().then(() => this.execute());
    return this.execution.then(onfulfilled, onrejected);
  }

  private addFilter(column: string, operator: Filter['operator'], value: any): this {
    this.filters.push({ column: column.replace(/"/g, ''), operator, value });
    return this;
  }

  private matches(row: Row): boolean {
    return this.filters.every(({ column, operator, value }) => {
      const actual = row[column];
      if (operator === 'eq') return actual === value;
      if (operator === 'neq') return actual !== value;
      if (operator === 'in') return Array.isArray(value) && value.includes(actual);
      if (operator === 'ilike') {
        const pattern = String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.');
        return new RegExp(`^${pattern}$`, 'i').test(String(actual ?? ''));
      }
      if (operator === 'gte') return String(actual ?? '') >= String(value);
      return String(actual ?? '') <= String(value);
    });
  }

  private project(row: Row): Row {
    const result = clone(row);
    if (this.projection.includes('effort_monthly(')) {
      result.effort_monthly = (database.effort_monthly || []).filter((item) => item.effort_id === row.id);
    }
    if (this.projection.includes('cr_items(')) {
      result.cr_items = (database.cr_items || []).filter((item) => item.cr_id === row.id);
    }
    if (this.projection === '*' || this.projection.includes('(*)')) return result;
    const columns = this.projection.split(',').map((column) => column.trim().replace(/"/g, '')).filter(Boolean);
    if (!columns.length) return result;
    const selected: Row = {};
    for (const column of columns) {
      if (column.endsWith('(*)')) {
        const relation = column.slice(0, -3);
        if (relation in result) selected[relation] = result[relation];
      } else if (column in result) {
        selected[column] = result[column];
      }
    }
    return selected;
  }

  private execute(): QueryResult {
    const rows = database[this.table] || (database[this.table] = []);
    let affected: Row[] = [];
    let didWrite = false;

    if (this.operation === 'select') {
      affected = rows.filter((row) => this.matches(row));
    } else if (this.operation === 'insert') {
      const values = Array.isArray(this.payload) ? this.payload : [this.payload];
      affected = values.map((value) => ({ created_at: now(), updated_at: now(), ...clone(value), id: value.id || newId(this.table) }));
      rows.push(...affected);
      didWrite = true;
    } else if (this.operation === 'upsert') {
      const values = Array.isArray(this.payload) ? this.payload : [this.payload];
      affected = values.map((value) => {
        const existing = rows.find((row) => this.conflictColumns.every((column) => row[column] === value[column]));
        if (existing) {
          Object.assign(existing, clone(value), { updated_at: now() });
          return existing;
        }
        const created = { created_at: now(), updated_at: now(), ...clone(value), id: value.id || newId(this.table) };
        rows.push(created);
        return created;
      });
      didWrite = true;
    } else if (this.operation === 'update') {
      affected = rows.filter((row) => this.matches(row));
      affected.forEach((row) => Object.assign(row, clone(this.payload), { updated_at: now() }));
      didWrite = affected.length > 0;
    } else {
      affected = rows.filter((row) => this.matches(row));
      const retained = rows.filter((row) => !this.matches(row));
      database[this.table] = retained;
      didWrite = affected.length > 0;
    }

    if (didWrite) persistDatabase();
    const count = affected.length;

    if (this.operation === 'select') {
      for (const order of [...this.orders].reverse()) {
        affected.sort((left, right) => {
          const a = left[order.column];
          const b = right[order.column];
          if (a == null || b == null) {
            if (a == null && b == null) return 0;
            return (a == null) === (order.nullsFirst === true) ? -1 : 1;
          }
          const comparison = typeof a === 'number' && typeof b === 'number'
            ? a - b
            : String(a).localeCompare(String(b), undefined, { numeric: true });
          return order.ascending ? comparison : -comparison;
        });
      }
      if (this.maximumRows !== null) affected = affected.slice(0, this.maximumRows);
    }

    if (this.cardinality === 'single') {
      return { data: affected[0] ? this.project(affected[0]) : null, error: null, count };
    }
    if (this.cardinality === 'maybeSingle') {
      return { data: affected[0] ? this.project(affected[0]) : null, error: null, count };
    }

    const shouldReturn = this.operation === 'select' || this.returning;
    const data = shouldReturn ? affected.map((row) => this.project(row)) : null;
    return { data, error: null, count };
  }
}

const demoUser = {
  id: 'demo-user',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'alex.morgan@example.test',
  app_metadata: { provider: 'mock' },
  user_metadata: { full_name: 'Alex Morgan' },
  created_at: new Date().toISOString(),
};

const demoSession = {
  access_token: 'mock-session-token',
  token_type: 'bearer',
  expires_in: 60 * 60 * 24,
  expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
  refresh_token: 'mock-refresh-token',
  user: demoUser,
};

export function createMockSupabase() {
  let authListener: ((event: string, session: typeof demoSession | null) => void) | null = null;
  const channel = {
    on() { return this; },
    subscribe() { return this; },
  };
  return {
    from(table: string) {
      return new MockQuery(table);
    },
    async rpc(name: string, args: Row = {}) {
      if (name === 'admin_update_user_role' || name === 'admin_update_user_access' || name === 'admin_update_user_profile') {
        const id = args.p_user_id || args.user_id;
        const profile = (database.profiles || []).find((row) => row.id === id);
        if (profile) {
          if (args.p_role) profile.role = args.p_role;
          if (args.p_is_active !== undefined && args.p_is_active !== null) profile.is_active = args.p_is_active;
          if (args.p_screen_permissions !== undefined && args.p_screen_permissions !== null) profile.screen_permissions = args.p_screen_permissions;
          if (args.p_project_access_scope) profile.project_access_scope = args.p_project_access_scope;
          if (args.p_full_name) profile.full_name = args.p_full_name;
          persistDatabase();
        }
      }
      if (name === 'admin_delete_inactive_user') {
        database.profiles = (database.profiles || []).filter((row) => row.id !== args.p_user_id);
        persistDatabase();
      }
      const data = name === 'validate_member_email' ? [{ email: args.p_email, type: 'internal' }] : null;
      return { data, error: null };
    },
    auth: {
      async getSession() { return { data: { session: clone(demoSession) }, error: null }; },
      onAuthStateChange(callback: (event: string, session: typeof demoSession | null) => void) {
        authListener = callback;
        queueMicrotask(() => callback('SIGNED_IN', clone(demoSession)));
        return { data: { subscription: { unsubscribe() { authListener = null; } } } };
      },
      async signOut() {
        authListener?.('SIGNED_OUT', null);
        return { error: null };
      },
      async signInWithPassword() {
        authListener?.('SIGNED_IN', clone(demoSession));
        return { data: { user: clone(demoUser), session: clone(demoSession) }, error: null };
      },
      async signUp() {
        authListener?.('SIGNED_IN', clone(demoSession));
        return { data: { user: clone(demoUser), session: clone(demoSession) }, error: null };
      },
    },
    channel() { return channel; },
    removeChannel() { return 'ok'; },
  };
}

export function resetMockDatabase(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Mock data storage could not be cleared.', error);
  }
  window.location.reload();
}
