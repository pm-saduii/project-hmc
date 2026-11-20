import type { OutputAsset, OutputChunk } from 'rollup';
import type { Plugin } from 'vite';

export function singleFileHtml(): Plugin {
  return {
    name: 'single-file-html',
    enforce: 'post',
    apply: 'build',
    generateBundle(_options, bundle) {
      const htmlEntry = bundle['index.html'];
      if (!htmlEntry || htmlEntry.type !== 'asset' || typeof htmlEntry.source !== 'string') {
        this.error('Could not find the built index.html entry.');
      }

      let html = htmlEntry.source;
      const styles = Object.values(bundle).filter(
        (output): output is OutputAsset => output.type === 'asset' && output.fileName.endsWith('.css'),
      );
      html = html.replace(/<link\b[^>]*href=["']([^"']+\.css(?:\?[^"']*)?)["'][^>]*>/g, (tag, href: string) => {
        const style = styles.find((item) => href.endsWith(item.fileName));
        if (!style) this.error(`Could not inline stylesheet ${href}.`);
        const content = typeof style.source === 'string' ? style.source : new TextDecoder().decode(style.source);
        return `<style>${content}</style>`;
      });

      html = html.replace(/<script\b[^>]*src=["']([^"']+\.js(?:\?[^"']*)?)["'][^>]*>\s*<\/script>/g, (tag, src: string) => {
        const fileName = src.split('/').pop()?.split('?')[0];
        const script = Object.values(bundle).find(
          (output): output is OutputChunk => output.type === 'chunk' && output.fileName.endsWith(fileName || ''),
        );
        if (!script) this.error(`Could not inline JavaScript bundle ${src}.`);
        return `<script type="module">${script.code.replace(/<\/script/gi, '<\\/script')}</script>`;
      });

      html = html
        .replace(/<link\b[^>]*rel=["']modulepreload["'][^>]*>/g, '')
        .replace(/<link\b[^>]*href=["']https?:\/\/[^"']*["'][^>]*>/g, '')
        .replace(/<link\b[^>]*href=["'][^"']*favicon\.ico[^"']*["'][^>]*>/g, '');

      const output: OutputAsset = { ...htmlEntry, fileName: 'project-mockup.html', source: html };
      delete bundle['index.html'];
      for (const [fileName, item] of Object.entries(bundle)) {
        if (item.type === 'chunk' || item.fileName.endsWith('.css')) delete bundle[fileName];
      }
      bundle[output.fileName] = output;
    },
  };
}
