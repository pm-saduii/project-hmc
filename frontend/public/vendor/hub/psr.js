/* Project Status Report – core (parse workbook → compute → render HTML).
   Works in the browser (window.PSR) and in Node (module.exports). */
(function (root) {
  "use strict";
  var DAY = 86400000;
  var STATUS = ["Completed", "On Track", "At Risk", "Delayed", "Not Started"];
  var SCLASS = { "Completed": "s-done", "On Track": "s-ok", "At Risk": "s-risk", "Delayed": "s-late", "Not Started": "s-ns" };
  var BCLASS = { "Paid": "s-done", "Invoiced": "s-ok", "Ready to Invoice": "s-risk", "Overdue": "s-late",
                 "Milestone Delayed": "s-late", "Pending Milestone": "s-ns" };

  // =====================================================================================
  // TH / EN – report text is written in English in the code; in Thai mode the HTML and the PPT text runs pass through tr().
  // Only fixed labels are in the dictionary; text typed in Excel is shown as typed (except status / type values and dates).
  // =====================================================================================
  var LANG = "en";
  function setLang(l) { LANG = l === "th" ? "th" : "en"; }
  function lang() { return LANG; }
  var TH_M = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
  var TH_S = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  var EN_L = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var EN_S = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var TH = {
    // status / enums
    "Completed": "เสร็จแล้ว", "On Track": "ตามแผน", "At Risk": "มีความเสี่ยง", "Delayed": "ล่าช้า", "Not Started": "ยังไม่เริ่ม", "On Hold": "พักไว้", "N/A": "N/A",
    "Done": "เสร็จ", "In Progress": "กำลังทำ", "Draft": "ร่าง", "Submitted": "ส่งขออนุมัติ", "Approved": "อนุมัติ", "Rejected": "ไม่อนุมัติ", "Deferred": "เลื่อนพิจารณา", "Cancelled": "ยกเลิก",
    "Paid": "ชำระแล้ว", "Invoiced": "ออกใบแจ้งหนี้แล้ว", "Ready to Invoice": "พร้อมออกใบแจ้งหนี้", "Overdue": "เกินกำหนดชำระ", "Milestone Delayed": "Milestone ล่าช้า", "Pending Milestone": "รอ Milestone",
    "Risk": "ความเสี่ยง", "Issue": "ปัญหา", "Decision Needed": "ขอมติ", "Coordination": "ประสานงาน", "Action": "Action", "Dependency": "การพึ่งพา", "Decision": "การตัดสินใจ",
    "Acknowledge": "รับทราบ", "High": "สูง", "Medium": "กลาง", "Low": "ต่ำ", "Urgent": "ด่วน", "Normal": "ปกติ", "Chargeable": "มีค่าใช้จ่าย", "Non-chargeable": "ไม่มีค่าใช้จ่าย",
    "Client": "ลูกค้า", "Joint": "ร่วมกัน", "JOINT": "ร่วมกัน", "Both": "ทั้ง 2 Phase", "Inbound": "ขาเข้า", "Outbound": "ขาออก", "2-ways": "สองทาง", "OPEN": "เปิด",
    "Project Managers": "ผู้จัดการโครงการ", "Steering Committee": "คณะกรรมการ Steering", "Project Sponsor": "ผู้สนับสนุนโครงการ", "Project Manager": "ผู้จัดการโครงการ",
    "Project Advisor": "ที่ปรึกษาโครงการ", "Project Lead": "หัวหน้าโครงการ", "Change Management": "Change Management", "Module Lead": "Module Lead", "Key User": "Key User", "Technical": "ทีมเทคนิค", "Functional": "ทีม Functional",
    // weekdays / units
    "Monday": "จันทร์", "Tuesday": "อังคาร", "Wednesday": "พุธ", "Thursday": "พฤหัสบดี", "Friday": "ศุกร์", "Saturday": "เสาร์", "Sunday": "อาทิตย์", "Today": "วันนี้", "This week": "สัปดาห์นี้",
    // status report (external / internal)
    "Project Status Summary": "สรุปสถานะโครงการ", "OVERALL STATUS": "สถานะรวม", "Overall status": "สถานะรวม", "OVERALL PROGRESS": "ความคืบหน้ารวม", "GO-LIVE": "GO-LIVE", "KEY MILESTONES": "MILESTONE สำคัญ",
    "Key accomplishments": "ผลงานสำคัญ", "Next steps": "ขั้นตอนถัดไป", "Milestones needing attention": "Milestone ที่ต้องติดตาม", "Top issues, risks & decisions": "ปัญหา ความเสี่ยง และเรื่องที่ต้องตัดสินใจ",
    "All key milestones on track": "Milestone สำคัญเป็นไปตามแผน", "No open items": "ไม่มีรายการค้าง", "Items for Steering": "เรื่องเสนอ Steering", "Key Upcoming Activities": "กิจกรรมสำคัญที่กำลังจะมาถึง",
    "Overall Project Timeline": "ภาพรวมแผนงานโครงการ", "Key Milestone Tracker": "ติดตาม Milestone สำคัญ", "Billing & Payment Status": "สถานะการเรียกเก็บเงิน", "Activity Breakdown": "รายละเอียดกิจกรรม",
    "Decision needed": "ขอให้ตัดสินใจ", "For acknowledgement": "ขอให้รับทราบ", "Completed": "เสร็จแล้ว", "Internal use only": "ใช้ภายในเท่านั้น", "INTERNAL · CONFIDENTIAL": "ภายใน · ลับ", "EXTERNAL": "ภายนอก",
    "INTERNAL": "ภายใน", "Behind plan": "ช้ากว่าแผน", "On or ahead of plan": "ตามแผนหรือเร็วกว่า", "Plan": "แผน", "Progress": "ความคืบหน้า", "Milestone": "Milestone", "Owner": "ผู้รับผิดชอบ",
    "Target": "เป้าหมาย", "Status": "สถานะ", "Phase": "Phase", "Start": "เริ่ม", "End": "สิ้นสุด", "Start Date": "วันเริ่ม", "End Date": "วันสิ้นสุด", "Due": "กำหนดเสร็จ", "% Done": "% เสร็จ",
    "Fee": "ค่าบริการ", "Installment": "งวด", "Amount": "จำนวนเงิน", "Invoice": "ใบแจ้งหนี้", "Collected": "รับชำระแล้ว", "Outstanding invoices": "ใบแจ้งหนี้ค้างชำระ", "CONTRACT VALUE": "มูลค่าสัญญา",
    "Contract value": "มูลค่าสัญญา", "% of contract": "% ของสัญญา", "No billing data.": "ยังไม่มีข้อมูลงวดเงิน", "Ready to invoice now": "พร้อมออกใบแจ้งหนี้", "Milestone completed – issue invoice now": "Milestone เสร็จแล้ว – ออกใบแจ้งหนี้ได้",
    "Finished last 7 days": "เสร็จใน 7 วันที่ผ่านมา", "Due next 14 days": "ครบกำหนดใน 14 วัน", "Overdue, not done": "เลยกำหนดแต่ยังไม่เสร็จ", "Late start": "เริ่มช้า", "Activity": "กิจกรรม", "Activities": "กิจกรรม",
    "days": "วัน", "overdue": "เลยกำหนด", "Overall progress": "ความคืบหน้ารวม", "Go-live": "Go-live", "KEY ACCOMPLISHMENTS": "ผลงานสำคัญ", "NEXT STEPS": "ขั้นตอนถัดไป", "MILESTONES NEEDING ATTENTION": "MILESTONE ที่ต้องติดตาม", "DECISION": "ขอมติ", "ACKNOWLEDGE": "แจ้งเพื่อทราบ", "Action": "การดำเนินการ",
    "STATUS": "สถานะ", "PHASE": "PHASE", "Topic": "หัวข้อ", "Remark": "หมายเหตุ", "Details / current status": "รายละเอียด / สถานะปัจจุบัน", "Ask from Steering": "สิ่งที่ขอจาก Steering", "Behind": "ช้ากว่าแผน",
    "AT RISK – MS LATE": "เสี่ยง – MILESTONE ช้า", "COLLECTED": "รับชำระแล้ว", "OUTSTANDING": "ค้างรับ", "READY TO INVOICE": "พร้อมออกใบแจ้งหนี้", "Invoice / payment": "ใบแจ้งหนี้ / การชำระ",
    "Condition / Trigger Milestone": "เงื่อนไข / Milestone ที่ผูก", "Target Date": "วันเป้าหมาย", "System / Interface": "ระบบ / Interface", "Direction": "ทิศทาง", "Data": "ข้อมูล",
    "IN SCOPE": "ในขอบเขต", "OUT OF SCOPE": "นอกขอบเขต", "KEY DELIVERABLES": "สิ่งส่งมอบหลัก", "SMART OBJECTIVES": "วัตถุประสงค์ SMART", "SUCCESS CRITERIA": "เกณฑ์ความสำเร็จ", "TOP RISKS": "ความเสี่ยงหลัก",
    "SPONSORS & TEAM": "ผู้สนับสนุนและทีม", "ASSUMPTIONS & CONSTRAINTS": "สมมติฐานและข้อจำกัด", "BUSINESS CASE": "เหตุผลทางธุรกิจ", "KEY MILESTONES ": "MILESTONE หลัก",
    "Jan": "ม.ค.", "Feb": "ก.พ.", "Mar": "มี.ค.", "Apr": "เม.ย.", "May": "พ.ค.", "Jun": "มิ.ย.", "Jul": "ก.ค.", "Aug": "ส.ค.", "Sep": "ก.ย.", "Oct": "ต.ค.", "Nov": "พ.ย.", "Dec": "ธ.ค.",
    "Amount (THB)": "จำนวนเงิน (บาท)", "CONTRACT VALUE (THB)": "มูลค่าสัญญา (บาท)", "Upcoming": "กำลังจะมาถึง", "Accomplishment": "ผลงาน", "Key date": "วันสำคัญ", "Report date": "วันที่รายงาน", "Go-live": "Go-live", "Key milestones": "Milestone หลัก", "Impact: S Scope · T Time · C Cost · Q Quality": "ผลกระทบ: S ขอบเขต · T เวลา · C ค่าใช้จ่าย · Q คุณภาพ", "Waiting on": "รอ", "✓ Done": "✓ เสร็จ", "KEY DATES": "วันสำคัญ",
    // kick-off
    "PROJECT KICK-OFF": "การประชุมเปิดโครงการ", "MEETING AGENDA": "วาระการประชุม", "OBJECTIVES OF TODAY'S MEETING": "วัตถุประสงค์ของการประชุมวันนี้", "SCOPE OF WORK AND KEY BENEFITS": "ขอบเขตงานและประโยชน์สำคัญ",
    "PROJECT METHODOLOGY": "ระเบียบวิธีดำเนินโครงการ", "PROJECT TEAM AND GOVERNANCE": "ทีมงานและการกำกับดูแลโครงการ", "OVERALL PROJECT TIMELINE": "ภาพรวมแผนงานโครงการ", "KEY SUCCESS FACTORS": "ปัจจัยสู่ความสำเร็จ",
    "NEXT STEPS": "ขั้นตอนถัดไป", "THE OBJECTIVES OF TODAY'S MEETING": "วัตถุประสงค์ของการประชุมวันนี้", "THE OBJECTIVES": "วัตถุประสงค์", "SCOPE OF WORK": "ขอบเขตงาน", "SYSTEM INTEGRATION": "การเชื่อมต่อระบบ",
    "KEY BENEFITS & OUTCOME": "ประโยชน์และผลลัพธ์สำคัญ", "PROJECT TEAM": "ทีมงานโครงการ", "GOVERNANCE STRUCTURE": "โครงสร้างการกำกับดูแล", "PAYMENT MILESTONES": "งวดการชำระเงิน",
    "KEY UPCOMING ACTIVITIES": "กิจกรรมสำคัญที่กำลังจะมาถึง", "NEXT STEPS / ACTIONS": "ขั้นตอนถัดไป / สิ่งที่ต้องดำเนินการ", "APPENDIX": "ภาคผนวก", "RISK MANAGEMENT": "การบริหารความเสี่ยง",
    "ROLE & RESPONSIBILITIES": "บทบาทและหน้าที่", "PROJECT REPORTING": "เอกสารและการรายงานโครงการ", "SYSTEM REQUIREMENTS": "ความต้องการของระบบ", "THANK YOU": "ขอบคุณ",
    "If you have any questions, please feel free to ask!": "หากมีข้อสงสัย สอบถามได้เลยค่ะ / ครับ", "Questions and decisions": "คำถามและมติที่ประชุม", "Client's Logo": "โลโก้ลูกค้า", "Confidential": "Confidential",
    "Share the overall project scope, key activities and methodology": "ชี้แจงขอบเขตโครงการ กิจกรรมหลัก และระเบียบวิธีดำเนินงาน",
    "Share project timelines and align on key next steps": "ชี้แจงกรอบเวลาโครงการ และตกลงขั้นตอนสำคัญถัดไปร่วมกัน", "Formal kick-off for": "เปิดโครงการอย่างเป็นทางการสำหรับ",
    "Cost Effective": "คุ้มค่าการลงทุน", "Standard Processes": "กระบวนการเป็นมาตรฐาน", "Standard Policies": "นโยบายเป็นมาตรฐาน", "Enhanced Employee Experience": "ประสบการณ์พนักงานที่ดีขึ้น",
    "Comprehensive and Accurate Database": "ฐานข้อมูลครบถ้วนและถูกต้อง", "Access to Real-Time Reports and Insights": "เข้าถึงรายงานและข้อมูลเชิงลึกแบบ Real-time",
    "Increased Work Productivity and Efficiency": "เพิ่มผลิตภาพและประสิทธิภาพการทำงาน", "Anywhere, Any Time Access": "ใช้งานได้ทุกที่ ทุกเวลา", "Consistent Program / Feature Updates": "อัปเดตโปรแกรมและฟีเจอร์อย่างต่อเนื่อง",
    "Increased System Security and Reliability": "ระบบปลอดภัยและเสถียรยิ่งขึ้น", "Seamless Integration Between Web and Mobile": "เชื่อมต่อ Web และ Mobile อย่างไร้รอยต่อ", "Improved Operational Management": "บริหารงานปฏิบัติการได้ดีขึ้น",
    "PLAN & SCOPE": "วางแผนและกำหนดขอบเขต", "DISCOVER": "สำรวจความต้องการ", "DEVELOP": "พัฒนาระบบ", "DEPLOY": "ทดสอบและเตรียมใช้งาน", "DELIVER": "ส่งมอบ",
    "Create Project Plan": "จัดทำแผนโครงการ", "Kick-Off": "ประชุมเปิดโครงการ", "Cloud Preparation": "เตรียมระบบ Cloud", "Gather Requirements": "เก็บความต้องการ", "Gap Analysis": "วิเคราะห์ช่องว่าง (Gap)",
    "Confirm Business Blueprint": "ยืนยัน Business Blueprint", "System Configuration": "ตั้งค่าระบบ", "System Customization": "ปรับแต่งระบบ", "System Integration": "เชื่อมต่อระบบ", "Unit Testing": "ทดสอบหน่วยย่อย (Unit Test)",
    "Data Migration": "ย้ายข้อมูล", "UAT": "UAT", "Train the Trainer": "อบรมผู้สอน (Train the Trainer)", "Payroll Parallel Run Testing": "ทดสอบเงินเดือนคู่ขนาน", "Go-Live": "Go-Live", "Post-Support": "ดูแลหลังใช้งาน",
    "Payroll Outsourcing Model (PO)": "รูปแบบ Payroll Outsourcing (PO)", "Payroll Outsourcing & ESS Model / SaaS (PE / SaaS)": "รูปแบบ Payroll Outsourcing & ESS / SaaS (PE / SaaS)",
    "Project Team Members": "สมาชิกทีมโครงการ", "Project Organization Chart": "แผนผังองค์กรโครงการ", "Steering Committee": "คณะกรรมการบริหารโครงการ", "Project Leads": "ผู้นำโครงการ", "Technical Team": "ทีมเทคนิค", "Project Governance & Reporting": "การกำกับดูแลและการรายงานโครงการ", "ESCALATION TIER": "ลำดับการยกระดับปัญหา", "Project Advisors": "ที่ปรึกษาโครงการ",
    "Project Team": "ทีมงานโครงการ", "Solutions": "แนวทางแก้ไข", "Risks & Escalations": "ความเสี่ยงและการยกระดับ", "PROJECT TEAM WEEKLY STATUS UPDATE MEETING": "ประชุมทีมโครงการประจำสัปดาห์",
    "MONTHLY STEERING COMMITTEE": "ประชุม Steering Committee ประจำเดือน", "CRITICAL SUCCESS FACTORS": "ปัจจัยวิกฤตสู่ความสำเร็จ", "KEY PRINCIPLES": "หลักการสำคัญ", "Timely decisions": "ตัดสินใจทันเวลา",
    "Strong governance": "การกำกับดูแลที่เข้มแข็ง", "Engaged executives": "ผู้บริหารมีส่วนร่วม", "Cooperative team members": "ทีมงานร่วมมือกัน", "Proactive issues and risk management": "บริหารปัญหาและความเสี่ยงเชิงรุก",
    "Effective decision making": "ตัดสินใจอย่างมีประสิทธิภาพ", "Project update consistency": "อัปเดตโครงการสม่ำเสมอ", "Kick-off": "Kick-off", "First 6 weeks after kick-off": "6 สัปดาห์แรกหลัง Kick-off",
    "Next Steps / Actions": "ขั้นตอนถัดไป / สิ่งที่ต้องดำเนินการ", "Expected Deliverables": "ผลงานที่ต้องส่งมอบ", "Remarks": "หมายเหตุ", "Due Date": "กำหนดเสร็จ", "★ Project Kick-off": "★ ประชุมเปิดโครงการ",
    "Project team commitment and alignment on goals, timelines and deliverables.": "ทีมโครงการมุ่งมั่นและเห็นตรงกันเรื่องเป้าหมาย กรอบเวลา และสิ่งที่ต้องส่งมอบ",
    "Clear and defined project plan and activities.": "แผนงานและกิจกรรมโครงการชัดเจน", "Consistent and transparent communications on changes, risks, issues (where required).": "สื่อสารการเปลี่ยนแปลง ความเสี่ยง และปัญหาอย่างสม่ำเสมอและโปร่งใส",
    "Regular checkpoints, project tracking and updates.": "มีจุดตรวจสอบ ติดตาม และอัปเดตโครงการสม่ำเสมอ", "Efficient and effective decision making from the steering committee / project advisors.": "Steering Committee / ที่ปรึกษาตัดสินใจได้รวดเร็วและมีประสิทธิภาพ",
    "Risks": "ความเสี่ยง", "Risk Impact": "ผลกระทบ", "Probability": "โอกาสเกิด", "Impact": "ผลกระทบ", "Document List": "รายการเอกสาร", "Objectives": "วัตถุประสงค์", "Timeline": "ช่วงเวลา", "Items": "รายการ", "Information": "รายละเอียด",
    "Client's team does not have the authorization to make decisions.": "ทีมลูกค้าไม่มีอำนาจตัดสินใจ", "Define their roles and responsibilities in advance.": "กำหนดบทบาทและหน้าที่ล่วงหน้า",
    "Change of system requirements": "ความต้องการระบบเปลี่ยนแปลง", "Clearly define the scope of work in each phase.": "กำหนดขอบเขตงานแต่ละ Phase ให้ชัดเจน",
    "Data availability / delayed data preparation": "ข้อมูลไม่พร้อม / เตรียมข้อมูลล่าช้า", "Evaluate data availability before entering data.": "ประเมินความพร้อมของข้อมูลก่อนนำเข้า",
    "Inaccurate customer data": "ข้อมูลลูกค้าไม่ถูกต้อง", "Thorough check of information before and after data migration.": "ตรวจสอบข้อมูลอย่างละเอียดก่อนและหลังย้ายข้อมูล",
    "Team change / lack of workforce": "เปลี่ยนทีมงาน / กำลังคนไม่พอ", "Plan resources in advance and focus on the highest priorities.": "วางแผนทรัพยากรล่วงหน้า และโฟกัสงานที่สำคัญที่สุด",
    "Delay in project verification": "การตรวจรับงานล่าช้า", "Identify the problems when work does not meet the schedule.": "ระบุปัญหาทันทีเมื่องานไม่เป็นไปตามแผน",
    "Customer changes the procedure or document format in operation.": "ลูกค้าเปลี่ยนขั้นตอนหรือรูปแบบเอกสารระหว่างดำเนินงาน", "Any modification in formatting is counted as a change.": "การแก้ไขรูปแบบใดๆ นับเป็นการเปลี่ยนแปลง (CR)",
    "Hardware system does not meet the standard.": "ฮาร์ดแวร์ไม่ได้มาตรฐาน", "Provide hardware that meets the specifications required by HMC.": "จัดเตรียมฮาร์ดแวร์ตามสเปกที่ HMC กำหนด",
    "Task increase due to user inconvenience.": "งานเพิ่มเพราะผู้ใช้ไม่สะดวก", "Major extra tasks are counted as additional tasks.": "งานเพิ่มขนาดใหญ่นับเป็นงานเพิ่มเติม",
    "Customer does not facilitate information verification.": "ลูกค้าไม่อำนวยความสะดวกในการตรวจสอบข้อมูล", "Clearly identify all necessary procedures to the customer.": "แจ้งขั้นตอนที่จำเป็นทั้งหมดให้ลูกค้าอย่างชัดเจน",
    "Project plan": "แผนโครงการ", "Project plan, Additional fees": "แผนโครงการ, ค่าใช้จ่ายเพิ่ม", "Additional fees": "ค่าใช้จ่ายเพิ่ม",
    "STEERING COMMITTEE": "STEERING COMMITTEE", "PROJECT ADVISOR": "ที่ปรึกษาโครงการ", "PROJECT MANAGER": "ผู้จัดการโครงการ", "FUNCTIONAL TEAM": "ทีม Functional", "TECHNICAL TEAM": "ทีมเทคนิค",
    "Set policy and priorities, approve scope and policy-level changes · Review goals, progress, costs and timeline · Resolve conflicts and make decisions": "กำหนดนโยบายและลำดับความสำคัญ อนุมัติขอบเขตและการเปลี่ยนแปลงระดับนโยบาย · ทบทวนเป้าหมาย ความคืบหน้า ค่าใช้จ่าย และกรอบเวลา · แก้ข้อขัดแย้งและตัดสินใจ",
    "Give advice and review the overall project · Analyze project risks": "ให้คำแนะนำและทบทวนภาพรวมโครงการ · วิเคราะห์ความเสี่ยง",
    "Plan, manage and control the project with the client PM · Focal point for all project activities · Control costs, risks and tasks · Report progress to the committee": "วางแผน บริหาร และควบคุมโครงการร่วมกับ PM ลูกค้า · เป็นศูนย์กลางของทุกกิจกรรม · ควบคุมค่าใช้จ่าย ความเสี่ยง และงาน · รายงานความคืบหน้าต่อคณะกรรมการ",
    "Analyze requirements and match them with the system · Define business processes and company policy with the client · Conduct end-user training": "วิเคราะห์ความต้องการและจับคู่กับระบบ · กำหนดกระบวนการและนโยบายร่วมกับลูกค้า · อบรมผู้ใช้งาน",
    "Develop requirements beyond the standard · Support and resolve technical issues · Coordinate connectivity with the client's technical team": "พัฒนาส่วนที่เกินมาตรฐาน · สนับสนุนและแก้ปัญหาทางเทคนิค · ประสานการเชื่อมต่อกับทีมเทคนิคลูกค้า",
    "Project Agenda": "วาระการประชุม (Agenda)", "Minutes of Meeting": "รายงานการประชุม (MOM)", "Project Issue": "ปัญหาโครงการ (Issue)", "Project Issue Log": "ทะเบียนปัญหา (Issue Log)",
    "Project Change Request": "คำขอเปลี่ยนแปลง (CR)", "Project Deliverable Sign-off": "เอกสารรับมอบงาน (Sign-off)", "Project Status Report": "รายงานสถานะโครงการ", "Training Attendees": "รายชื่อผู้เข้าอบรม",
    "Customer Service Sheet": "ใบบันทึกงานบริการ", "Prepare the information, documents and persons involved in the meeting.": "เตรียมข้อมูล เอกสาร และผู้เกี่ยวข้องในการประชุม",
    "Summarize what happened during the meeting and acknowledgement sign.": "สรุปสิ่งที่เกิดขึ้นในการประชุมและลงนามรับทราบ", "Issue case, clarification, escalation guideline and action plan.": "รายละเอียดปัญหา แนวทางยกระดับ และแผนแก้ไข",
    "Change request documents, issue tracking, escalation and resolution.": "เอกสาร CR ติดตามปัญหา การยกระดับ และการแก้ไข", "Scope modification or additional details after Business Blueprint confirmation.": "การแก้ไขขอบเขตหรือรายละเอียดเพิ่มหลังยืนยัน Business Blueprint",
    "Approval documents confirming each work process.": "เอกสารอนุมัติยืนยันแต่ละขั้นงาน", "Status update including timeline and missed milestones.": "อัปเดตสถานะ รวมแผนงานและ Milestone ที่พลาด",
    "Signed attendance for system usage training.": "ลงชื่อเข้าอบรมการใช้งานระบบ", "Job completion documents for HMC operations working period.": "เอกสารยืนยันงานเสร็จของทีมปฏิบัติการ HMC",
    "Before the meeting": "ก่อนการประชุม", "After every meeting": "หลังประชุมทุกครั้ง", "Problem occurs": "เมื่อเกิดปัญหา", "Submission of the change request": "เมื่อยื่น CR", "According to delivery list": "ตามรายการส่งมอบ",
    "Every 2 weeks": "ทุก 2 สัปดาห์", "Every training class": "ทุกรอบการอบรม", "Every time of working": "ทุกครั้งที่ปฏิบัติงาน", "Web browser": "เว็บเบราว์เซอร์", "Mobile OS": "ระบบปฏิบัติการมือถือ",
    "Google Chrome (recommended) · Microsoft Edge · Mozilla Firefox · Safari – latest versions": "Google Chrome (แนะนำ) · Microsoft Edge · Mozilla Firefox · Safari – เวอร์ชันล่าสุด",
    "iOS and Android – versions supported by the mobile application": "iOS และ Android – เวอร์ชันที่แอปรองรับ",
    "Baseline project plan / RAID log": "แผนโครงการตั้งต้น / RAID log", "Cloud environment ready": "ระบบ Cloud พร้อมใช้", "Requirement & Fit/Gap log": "ทะเบียน Requirement & Fit/Gap",
    "Signed Business Blueprint": "Business Blueprint ที่ลงนามแล้ว", "Configured system": "ระบบที่ตั้งค่าแล้ว", "Functional design / interface spec": "Functional design / Interface spec", "Data migration templates": "แบบฟอร์มย้ายข้อมูล",
    "Change impact assessment": "ประเมินผลกระทบการเปลี่ยนแปลง", "Change & communication plan": "แผน Change & Communication", "Change ambassador list": "รายชื่อ Change Ambassador",
    // charter
    "PROJECT CHARTER": "ใบอนุมัติโครงการ (PROJECT CHARTER)", "PROJECT CHARTER CANVAS": "สรุปโครงการหน้าเดียว (CHARTER CANVAS)", "WHY": "ทำไม", "WHAT": "ทำอะไร", "DONE": "สำเร็จเมื่อ", "IN": "ในขอบเขต",
    "OUT": "นอกขอบเขต", "DELIVER": "ส่งมอบ", "WHEN": "เมื่อไร", "COST": "งบประมาณ", "WHO": "ใคร", "RISK": "ความเสี่ยง", "IF": "เงื่อนไข", "Business case": "เหตุผลทางธุรกิจ", "SMART objectives": "วัตถุประสงค์ SMART",
    "Success criteria": "เกณฑ์ความสำเร็จ", "In scope": "ในขอบเขต", "Out of scope": "นอกขอบเขต", "Key deliverables": "สิ่งส่งมอบหลัก", "Key milestones": "Milestone หลัก", "Budget": "งบประมาณ",
    "Sponsors & team": "ผู้สนับสนุนและทีม", "Top risks": "ความเสี่ยงหลัก", "Assumptions & constraints": "สมมติฐานและข้อจำกัด", "BUSINESS CASE & PURPOSE": "เหตุผลทางธุรกิจและเป้าหมายโครงการ",
    "Why we are doing this project and what success looks like": "ทำไมต้องทำโครงการนี้ และความสำเร็จหน้าตาเป็นอย่างไร", "PROJECT PURPOSE / VISION": "เป้าหมาย / วิสัยทัศน์โครงการ",
    "BUSINESS CASE / PROBLEM STATEMENT": "เหตุผลทางธุรกิจ / ปัญหาที่ต้องแก้", "EXPECTED BENEFITS": "ประโยชน์ที่คาดว่าจะได้รับ", "OBJECTIVES & SUCCESS CRITERIA": "วัตถุประสงค์และเกณฑ์ความสำเร็จ",
    "Objective": "วัตถุประสงค์", "KPI / Measure": "ตัวชี้วัด", "SUCCESS CRITERIA (PROJECT ACCEPTANCE)": "เกณฑ์ความสำเร็จ (การรับมอบโครงการ)", "Success criterion": "เกณฑ์ความสำเร็จ",
    "Evidence / Measure": "หลักฐาน / การวัด", "Accepted by": "ผู้รับรอง", "PROJECT DOCUMENTS": "เอกสารโครงการ", "NEXT MEETING AGENDA": "วาระการประชุมครั้งถัดไป", "MINUTES OF MEETING & RAIDD LOG": "รายงานการประชุม & ทะเบียน RAIDD", "DELIVERABLE SIGN-OFF": "การรับมอบงาน (SIGN-OFF)",
    "BUSINESS BLUEPRINT & TRAINING": "BUSINESS BLUEPRINT & การอบรม", "BB APPENDIX REVIEW": "ตรวจ APPENDIX ของ BB", "Appendix": "Appendix", "MEETINGS": "การประชุม", "OPEN RAIDD": "RAIDD ที่ยังเปิด", "SIGN-OFF": "รับมอบงาน", "deliverables signed": "รายการลงนามแล้ว", "final or signed": "Final หรือลงนามแล้ว",
    "Status in this project": "สถานะในโครงการนี้", "Output": "รูปแบบ", "Meeting ID": "รหัสประชุม", "Meeting": "การประชุม", "Period": "ช่วงเวลา", "Signed": "ลงนามแล้ว", "Client owner": "ผู้รับผิดชอบ (ลูกค้า)", "Session": "รอบ", "Subject": "หัวข้อ", "Att.": "ผู้เข้า",
    "Operations form – outside this kit": "แบบฟอร์มฝ่าย Operation – อยู่นอกชุดนี้", "Final": "Final", "Client Review": "ลูกค้าตรวจ", "Revised": "แก้ไขแล้ว", "Pending": "รอดำเนินการ", "Planned": "วางแผนไว้",
    "Sheet Meetings + Issues (RAIDD) · MOM Word form v1.4 per meeting": "ชีท Meetings + Issues (RAIDD) · ฟอร์ม MOM (Word v1.4) ต่อการประชุม",
    "Sheet Sign-off · dates from Schedule when blank · Word form v1.3 per deliverable": "ชีท Sign-off · ไม่กรอกวันที่ = ดึงจาก Schedule · ฟอร์ม Word v1.3 ต่อรายการ",
    "Sheet BB (version control: Draft → Client Review → Revised → Final → Signed) · Sheet Training (HRM-FM-005)": "ชีท BB (คุมเวอร์ชัน: Draft → Client Review → Revised → Final → Signed) · ชีท Training (HRM-FM-005)", "Contingency": "สำรอง", "Constraints": "ข้อจำกัด", "Key Risks": "ความเสี่ยงหลัก", "Change Control": "การควบคุมการเปลี่ยนแปลง", "Escalation": "ยกระดับภายใน", "business days": "วันทำการ", "All modules in scope": "ทุกโมดูลในขอบเขต", "As per contract": "ตามสัญญา", "SCOPE STATEMENT": "ขอบเขตโครงการ", "What is in and out · anything outside goes through Change Request": "อะไรอยู่ใน/นอกขอบเขต · นอกขอบเขตต้องผ่าน Change Request",
    "✓ IN SCOPE": "✓ ในขอบเขต", "✕ OUT OF SCOPE": "✕ นอกขอบเขต", "DELIVERABLES & ACCEPTANCE": "สิ่งส่งมอบและการรับมอบ", "Due dates follow the Schedule stage linked in sheet Charter": "วันครบกำหนดตาม Stage ที่ผูกไว้ในชีท Charter",
    "Deliverable": "สิ่งส่งมอบ", "Due (Phase 1 / Phase 2)": "กำหนดส่ง (Phase 1 / Phase 2)", "SUMMARY MILESTONE SCHEDULE": "สรุปกำหนดการ Milestone", "Calculated from Go-live − duration (sheet Kickoff / Schedule)": "คำนวณจาก Go-live ย้อนตามระยะเวลา (ชีท Kickoff / Schedule)",
    "Business Blueprint sign-off": "ลงนาม Business Blueprint", "UAT & SIT complete": "UAT & SIT เสร็จ", "Payroll parallel run": "ทดสอบเงินเดือนคู่ขนาน", "Hypercare closed": "ปิด Hypercare",
    "BUDGET SUMMARY": "สรุปงบประมาณ", "Payment installments are triggered by project milestones (sheet Billing)": "งวดชำระเงินผูกกับ Milestone (ชีท Billing)", "TOTAL BUDGET": "งบประมาณรวม", "CONTINGENCY RESERVE": "งบสำรองความเสี่ยง",
    "INSTALLMENTS": "งวดชำระ", "As per contract": "ตามสัญญา", "Use of contingency is reported to the Steering Committee · new scope is costed through Change Request": "การใช้งบสำรองต้องรายงาน Steering · งานใหม่คิดค่าใช้จ่ายผ่าน Change Request",
    "Trigger milestone": "Milestone เงื่อนไข", "Target date": "วันเป้าหมาย", "STAKEHOLDER MAP": "แผนผังผู้มีส่วนได้ส่วนเสีย", "Keep Satisfied": "ดูแลให้พึงพอใจ", "Manage Closely": "บริหารใกล้ชิด", "Monitor": "ติดตาม", "Keep Informed": "แจ้งให้ทราบสม่ำเสมอ",
    "High influence · lower interest": "อิทธิพลสูง · ความสนใจน้อย", "High influence · high interest": "อิทธิพลสูง · ความสนใจสูง", "Lower influence · lower interest": "อิทธิพลน้อย · ความสนใจน้อย", "Lower influence · high interest": "อิทธิพลน้อย · ความสนใจสูง",
    "INFLUENCE →": "อิทธิพล →", "INTEREST →": "ความสนใจ →", "RACI MATRIX": "ตาราง RACI", "Who is Responsible · Accountable · Consulted · Informed": "ใครลงมือทำ · รับผิดชอบสุดท้าย · ให้คำปรึกษา · รับทราบ",
    "Activity / Deliverable": "กิจกรรม / สิ่งส่งมอบ", "Client PM": "PM ลูกค้า", "HMC PM": "PM HMC", "Key Users / Module Leads": "Key User / Module Lead", "HMC Functional": "HMC Functional", "HMC Technical": "HMC Technical",
    "Responsible": "ผู้ลงมือทำ", "Accountable": "ผู้รับผิดชอบสุดท้าย", "Consulted": "ผู้ให้คำปรึกษา", "Informed": "ผู้รับทราบ", "does the work": "ลงมือทำงาน", "one owner, signs off": "มีคนเดียว ลงนามรับ", "two-way input": "ให้ความเห็นสองทาง", "kept up to date": "รับทราบความคืบหน้า",
    "Project Charter & Plan": "Project Charter และแผนงาน", "Requirements & Business Blueprint": "Requirement และ Business Blueprint", "Configuration & Unit Test": "ตั้งค่าและ Unit Test", "Interfaces & Customization": "Interface และการปรับแต่ง",
    "UAT & SIT": "UAT & SIT", "Training": "การอบรม", "Change Requests": "Change Request", "Go / No-Go Decision": "ตัดสินใจ Go / No-Go", "Hypercare & Handover": "Hypercare และส่งมอบ",
    "RISKS · ASSUMPTIONS · CONSTRAINTS": "ความเสี่ยง · สมมติฐาน · ข้อจำกัด", "ASSUMPTIONS": "สมมติฐาน", "CONSTRAINTS": "ข้อจำกัด", "Response": "แนวทางรับมือ",
    "GOVERNANCE & PM AUTHORITY": "การกำกับดูแลและอำนาจ PM", "Decision rights, escalation path and change control": "สิทธิ์การตัดสินใจ ลำดับการยกระดับ และการควบคุมการเปลี่ยนแปลง", "Area": "เรื่อง", "Project Manager authority": "อำนาจของผู้จัดการโครงการ",
    "Sponsors / Steering Committee": "ผู้สนับสนุน / Steering Committee", "Day-to-day issues · weekly status": "ปัญหาประจำวัน · สถานะรายสัปดาห์", "▲ escalate": "▲ ยกระดับ", "APPROVAL & SIGN-OFF": "การอนุมัติและลงนาม",
    "By signing this charter the sponsors formally authorize the project, commit the resources described above and give the Project Managers the authority stated in Governance & PM Authority.": "การลงนามใน Charter นี้ถือเป็นการอนุมัติโครงการอย่างเป็นทางการ จัดสรรทรัพยากรตามที่ระบุ และมอบอำนาจให้ผู้จัดการโครงการตามหัวข้อการกำกับดูแลและอำนาจ PM",
    "Signature": "ลายมือชื่อ", "Date": "วันที่", "Sponsors": "ผู้สนับสนุน", "PMs": "PM", "Team": "ทีม",
    // steering
    "STEERING COMMITTEE MEETING": "การประชุม STEERING COMMITTEE", "AGENDA": "วาระการประชุม", "EXECUTIVE DASHBOARD": "สรุปผู้บริหาร", "DECISIONS NEEDED": "เรื่องที่ขอมติ", "FOR ACKNOWLEDGEMENT": "เรื่องแจ้งเพื่อทราบ",
    "KEY MILESTONE STATUS": "สถานะ Milestone สำคัญ", "TOP RISKS & ISSUES": "ความเสี่ยงและปัญหาสำคัญ", "PAYMENT MILESTONES VS PLAN": "งวดชำระเงินเทียบแผน", "NEXT 30 DAYS": "30 วันข้างหน้า", "CHANGE REQUESTS": "CHANGE REQUEST",
    "SCHEDULE": "กำหนดการ", "SCOPE": "ขอบเขต", "BUDGET": "งบประมาณ", "QUALITY": "คุณภาพ", "ASSESSMENT": "การประเมิน", "PHASE PROGRESS · ACTUAL vs PLAN": "ความคืบหน้าราย Phase · จริง เทียบ แผน",
    "Steering Committee is asked to decide": "ขอให้ Steering Committee พิจารณาตัดสินใจ", "tick the resolution in the meeting": "ทำเครื่องหมายมติในที่ประชุม", "No decision needed this period": "รอบนี้ไม่มีเรื่องขอมติ",
    "Status and response plans the Steering Committee is asked to note": "สถานะและแผนรับมือที่ขอให้ Steering รับทราบ", "Nothing for acknowledgement this period": "รอบนี้ไม่มีเรื่องแจ้งเพื่อทราบ",
    "Progress (actual ▮ vs plan ┃)": "ความคืบหน้า (จริง ▮ เทียบแผน ┃)", "Progress (actual vs plan)": "ความคืบหน้า (จริง เทียบแผน)", "Type": "ประเภท", "Risk / Issue": "ความเสี่ยง / ปัญหา", "Response / Mitigation": "แนวทางรับมือ",
    "Owner · Due": "ผู้รับผิดชอบ · กำหนด", "Planned": "ตามแผน", "KEY MILESTONES DUE": "MILESTONE ที่ใกล้ครบกำหนด", "ACTIVITIES IN PROGRESS / STARTING": "กิจกรรมที่กำลังทำ / กำลังเริ่ม", "NEXT STEERING": "STEERING ครั้งถัดไป",
    "No key milestone due": "ไม่มี Milestone ครบกำหนด", "Key milestones due in the next 45 days · activities in the next 30 days": "Milestone ที่ครบกำหนดใน 45 วัน · กิจกรรมใน 30 วัน",
    "Key milestones due in the next 45 days and activities in the next 30 days": "Milestone ที่ครบกำหนดใน 45 วัน และกิจกรรมใน 30 วัน", "☐ Approved": "☐ อนุมัติ", "☐ Approved with conditions": "☐ อนุมัติแบบมีเงื่อนไข", "☐ Rejected": "☐ ไม่อนุมัติ", "☐ Deferred": "☐ เลื่อนพิจารณา",
    "☐ Approved    ☐ Approved with conditions    ☐ Rejected    ☐ Deferred": "☐ อนุมัติ    ☐ อนุมัติแบบมีเงื่อนไข    ☐ ไม่อนุมัติ    ☐ เลื่อนพิจารณา",
    "Key milestones on plan": "Milestone สำคัญตามแผน", "No open scope item": "ไม่มีเรื่องขอบเขตค้าง", "No open quality item": "ไม่มีเรื่องคุณภาพค้าง", "Payments on plan": "การชำระเงินตามแผน", "Payment milestone delayed": "งวดชำระล่าช้าตาม Milestone", "Overdue payment": "มีค่างวดค้างชำระ",
    // change requests
    "CHANGE REQUEST REGISTER": "ทะเบียน CHANGE REQUEST", "PENDING APPROVAL": "รออนุมัติ", "APPROVED": "อนุมัติแล้ว", "CHARGEABLE (APPROVED)": "มีค่าใช้จ่าย (อนุมัติแล้ว)", "in register": "ในทะเบียน",
    "CR No": "เลขที่ CR", "Name of Request": "ชื่อคำขอ", "Priority": "ความเร่งด่วน", "Service Type": "ประเภทบริการ", "MD": "MD", "Approval by": "ผู้อนุมัติ", "Expected Finish": "คาดว่าเสร็จ", "Exp. Finish": "คาดว่าเสร็จ",
    "Pre-check": "ตรวจเบื้องต้น", "Check": "ตรวจ", "NAME OF REQUEST": "ชื่อคำขอ", "BACKGROUND": "ที่มา", "IMPLEMENTATION REQUIREMENT": "ข้อกำหนดการดำเนินงาน", "RISKS": "ความเสี่ยง", "IMPACTED MODULES": "โมดูลที่ได้รับผลกระทบ",
    "EFFORT & COST": "ประมาณการแรงงานและค่าใช้จ่าย", "PLAN (PART 3)": "แผนงาน (PART 3)", "PM PRE-CHECK": "ตรวจสอบเบื้องต้นโดย PM", "Change Request Confirmation": "ยืนยัน Change Request", "Requirement Confirmation": "ยืนยัน Requirement",
    "Software Configuration": "ตั้งค่าซอฟต์แวร์", "Software Modification": "แก้ไขซอฟต์แวร์", "Functional Test": "Functional Test", "User Acceptance Test": "User Acceptance Test", "Production Deployment": "ติดตั้งขึ้น Production", "System go-live / Rollout": "Go-live / Rollout",
    "Impacted modules are within the contracted scope": "โมดูลที่กระทบอยู่ในขอบเขตสัญญา", "Missing: impacted modules (Part 2)": "ยังไม่ระบุโมดูลที่กระทบ (Part 2)", "Missing: effort estimate (man-days)": "ยังไม่ประมาณการ Man-day",
    "Chargeable CR without Payment Terms": "CR มีค่าใช้จ่ายแต่ยังไม่ระบุเงื่อนไขชำระเงิน", "Planned finish dates are not in sequence (Part 3)": "วันที่ใน Part 3 ไม่เรียงลำดับ", "Last milestone is after the Expected Finish Date": "Milestone สุดท้ายเกินวันที่คาดว่าเสร็จ",
    "Lands in the 30-day go-live freeze window – Steering to confirm": "อยู่ในช่วง Freeze 30 วันก่อน Go-live – ให้ Steering ยืนยัน", "Decision Date is empty": "ยังไม่ระบุวันที่ตัดสินใจ",
    "Non-chargeable but above the PM limit – confirm with the account manager": "ไม่มีค่าใช้จ่ายแต่เกินวงเงิน PM – ยืนยันกับ Account Manager", "Integration impact – check the interface against the integration list in sheet Kickoff": "กระทบการเชื่อมต่อ – ตรวจกับรายการ Interface ในชีท Kickoff",
    "Partial Payment (50/50)": "ชำระ 2 งวด (50/50)", "Paid in Advance (100%)": "ชำระล่วงหน้า (100%)"
  };
  // fragments inside longer text (longest first); kept to distinctive phrases so typed data is left alone
  var TH_FRAG = [
    ["Register status · Submitted CRs above the PM limit", "สถานะทะเบียน · CR ที่ส่งแล้วและเกินวงเงิน PM"], ["need a Steering decision", "ต้องขอมติ Steering"], ["need Steering", "ต้องขอมติ Steering"],
    ["Sheet CR · approval limit for Project Managers:", "ชีท CR · วงเงินที่ PM อนุมัติได้:"], ["man-days (sheet Charter)", "Man-day (ชีท Charter)"],
    ["Status as of", "สถานะ ณ"], ["RAG by PMI performance dimension", "RAG ตามมิติการวัดผลของ PMI"], ["days to go-live", "วันถึง Go-live"], ["key milestone(s) overdue", "Milestone สำคัญเลยกำหนด"],
    ["open scope item(s)", "เรื่องขอบเขตค้าง"], ["open quality item(s)", "เรื่องคุณภาพค้าง"], ["Actual vs planned % at", "% จริงเทียบแผน ณ"], ["bar = actual, line = plan", "แถบ = จริง, เส้น = แผน"],
    ["open items · top", "รายการเปิดอยู่ · อันดับแรก"], ["by severity · decisions are on their own page", "ตามความรุนแรง · เรื่องขอมติอยู่หน้าแยก"], ["Planned = installments whose trigger milestone was due by", "แผน = งวดที่ Milestone เงื่อนไขถึงกำหนดภายใน"],
    ["One-page summary for Sponsor approval · Version", "สรุปหน้าเดียวเพื่อขออนุมัติจากผู้สนับสนุน · เวอร์ชัน"], ["Charter version", "Charter เวอร์ชัน"],
    ["High-level risks at initiation", "ความเสี่ยงระดับสูงตอนเริ่มโครงการ"], ["(standard register – add project-specific risks in sheet Charter)", "(ทะเบียนมาตรฐาน – เพิ่มความเสี่ยงของโครงการในชีท Charter)"],
    ["Power / interest grid · engagement strategy per quadrant", "ตารางอิทธิพล / ความสนใจ · กลยุทธ์ดูแลแต่ละกลุ่ม"], ["grouped from the project team (sheet Kickoff)", "จัดกลุ่มจากทีมโครงการ (ชีท Kickoff)"],
    ["Objectives are", "วัตถุประสงค์ต้องเป็นแบบ"], ["Specific", "เฉพาะเจาะจง"], ["Measurable", "วัดผลได้"], ["Achievable", "ทำได้จริง"], ["Relevant", "สอดคล้อง"], ["Time-bound", "มีกรอบเวลา"],
    ["man-days", "Man-day"], ["Scope, budget, milestone changes", "เปลี่ยนขอบเขต งบประมาณ หรือ Milestone"],
    ["To ensure successful delivery of the project implementation,", "เพื่อให้การดำเนินโครงการสำเร็จ"], ["need to work closely together as a united team.", "ต้องทำงานร่วมกันอย่างใกล้ชิดเป็นทีมเดียวกัน"],
    ["Interfaces in scope", "Interface ในขอบเขต"], ["Installments and target dates follow the project milestones", "งวดและวันเป้าหมายเป็นไปตาม Milestone ของโครงการ"],
    ["→ approval by", "→ อนุมัติโดย"], ["(limit", "(วงเงิน"], ["MD, sheet Charter)", "MD, ชีท Charter)"], 
    ["Not in contracted modules (sheet Kickoff):", "ไม่อยู่ในโมดูลตามสัญญา (ชีท Kickoff):"], ["→ new scope, normally Chargeable", "→ เป็นงานใหม่ ปกติคิดค่าใช้จ่าย"],
    ["Finishes after go-live", "เสร็จหลัง Go-live"], ["– deliver in hypercare or a later release", "– ส่งมอบช่วง Hypercare หรือรอบถัดไป"], ["Missing:", "ยังไม่ระบุ:"], ["– done", "– เสร็จ"],
    ["requested", "ขอเมื่อ"], ["expected finish", "คาดว่าเสร็จ"], ["Approval by", "อนุมัติโดย"], ["Phase progress", "ความคืบหน้าราย Phase"],
    
  ];
  var THF = TH_FRAG.filter(function (f) { return f[0]; }).sort(function (a, b) { return b[0].length - a[0].length; }).map(function (f) {
    var e = f[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), b0 = /^\w/.test(f[0]) ? "\\b" : "", b1 = /\w$/.test(f[0]) ? "\\b" : "";
    return [new RegExp(b0 + e + b1, "g"), f[1]]; });
  var TH_RULES = [
    [/^9 project documents \(Methodology\) · Job Code (.+) · as of (.+)$/, "เอกสาร 9 รายการตาม Methodology · Job Code $1 · ข้อมูล ณ $2"], [/^(\d+) draft MOM$/, "MOM ฉบับร่าง $1"], [/^(\d+) overdue$/, "เลยกำหนด $1"],
    [/^(\d+) items for the next meeting$/, "$1 เรื่องสำหรับประชุมครั้งถัดไป"], [/^(\d+) meetings · (\d+) final$/, "ประชุม $1 ครั้ง · Final $2"], [/^(\d+) open RAIDD items$/, "RAIDD ที่ยังเปิด $1 รายการ"],
    [/^(\d+) RAIDD items · (\d+) escalated$/, "RAIDD $1 รายการ · ยกระดับ $2"], [/^(\d+) CRs · (\d+) pending$/, "CR $1 รายการ · รออนุมัติ $2"], [/^(\d+) of (\d+) signed$/, "ลงนามแล้ว $1 จาก $2"], [/^(\d+) sessions$/, "อบรม $1 รอบ"],
    [/^Built from open RAIDD items and milestones in the next 14 days · last meeting (.+)$/, "สร้างจาก RAIDD ที่ยังเปิดและ Milestone ใน 14 วันข้างหน้า · ประชุมล่าสุด $1"], [/^Built from open RAIDD items and milestones in the next 14 days$/, "สร้างจาก RAIDD ที่ยังเปิดและ Milestone ใน 14 วันข้างหน้า"],
    [/^1 · DECISIONS NEEDED \((\d+)\)$/, "1 · เรื่องที่ต้องตัดสินใจ ($1)"], [/^2 · OVERDUE ACTIONS \((\d+)\)$/, "2 · งานเลยกำหนด ($1)"], [/^3 · DUE IN 14 DAYS \((\d+)\)$/, "3 · ครบกำหนดใน 14 วัน ($1)"], [/^4 · KEY MILESTONES IN 14 DAYS \((\d+)\)$/, "4 · Milestone สำคัญใน 14 วัน ($1)"],
    [/^(\d+) closed$/, "ปิดแล้ว $1"],
    [/^Plan (\d+%) at (.+)$/, "แผน $1 ณ $2"], [/^Behind plan by (\d+) pts$/, "ช้ากว่าแผน $1 จุด"], [/^Ahead of plan by (\d+) pts$/, "เร็วกว่าแผน $1 จุด"],
    [/^Progress (\d+%)\s+·\s+Plan (\d+%)$/, "ความคืบหน้า $1  ·  แผน $2"], [/^Progress$/, "ความคืบหน้า"], [/^Plan (\d+%)$/, "แผน $1"], [/^·\s+Plan (\d+%)$/, "·  แผน $1"],
    [/^(\d+) days to go-live · (.+)$/, "อีก $1 วันถึง Go-live · $2"], [/^days$/, "วัน"], [/^days to go-live$/, "วันถึง Go-live"], [/^Project Lead$/, "หัวหน้าโครงการ"],
    [/\bVersion (\S+)/g, "เวอร์ชัน $1"],
    [/^Resolve within (\d+) business days · CR ≤ (\d+) man-days$/, "แก้ไขภายใน $1 วันทำการ · CR ≤ $2 Man-day"], [/^Key milestones \((\d+)\)$/, "Milestone สำคัญ ($1)"], [/^KEY MILESTONES \((\d+)\)$/, "MILESTONE สำคัญ ($1)"],
    [/^(.+) – (\d+) installments$/, "$1 – $2 งวด"],
    [/^(\d+) open$/, "เปิดอยู่ $1"], [/^(\d+%) · target (.+?)( · )?$/, function (m, p, d, t) { return p + " · เป้าหมาย " + d + (t || ""); }],
    [/^(ISSUE|RISK|DECISION NEEDED|COORDINATION|ACTION|DEPENDENCY|DECISION) · (.+)$/, function (m, k, x) { var e = { "ISSUE": "ปัญหา", "RISK": "ความเสี่ยง", "DECISION NEEDED": "ขอมติ", "COORDINATION": "ประสานงาน", "ACTION": "ACTION", "DEPENDENCY": "การพึ่งพา", "DECISION": "มติ" }; return e[k] + " · " + x; }],
    [/^(\d+) Decision needed · .+$/, "$1 เรื่องขอให้ตัดสินใจ"], [/^(\d+) For acknowledgement · .+$/, "$1 เรื่องแจ้งเพื่อทราบ"],
    [/^Top issues, risks & decisions \((\d+) open\)$/, "ปัญหา ความเสี่ยง และเรื่องที่ต้องตัดสินใจ ($1 เรื่องเปิดอยู่)"], [/^Week \+(\d+)$/, "สัปดาห์ +$1"], [/^Overdue \+(\d+)d$/, "เลยกำหนด +$1 วัน"],
    [/^·\s+5-week look-ahead$/, "·  มองล่วงหน้า 5 สัปดาห์"], [/^● (\d+) (.+)$/, function (m, n, x) { return "● " + n + " " + (TH[x] || x); }], [/^(\d+) days$/, "$1 วัน"],
    [/^(.+?) \((\d+\/\d+)\)$/, function (m, x, n) { return (TH[x] || TH[x.toUpperCase()] || x) + " (" + n + ")"; }], [/^(DECISIONS NEEDED|FOR ACKNOWLEDGEMENT) \((\d+)\)$/, function (m, x, n) { return TH[x] + " (" + n + ")"; }],
    [/^Team: (\d+) (.+) · (\d+) (.+)$/, "ทีม: $2 $1 คน · $4 $3 คน"], [/^(\d+) across (\d+) fee types$/, "$1 งวด จาก $2 ประเภทค่าบริการ"],
    [/^(.+) ×(\d+)$/, function (m, r, n) { return (TH[r] || r) + " ×" + n; }], [/^(\d+) draft$/, "ร่าง $1"], [/^Report Date (.+)$/, "วันที่รายงาน $1"], [/^Overall status$/, "สถานะรวม"],
    [/^Approval by (.+)$/, function (m, x) { return "อนุมัติโดย " + (TH[x.split(" · ")[0]] || x.split(" · ")[0]) + (x.indexOf(" · ") > 0 ? " · " + x.split(" · ").slice(1).map(function (p) { return TH[p] || p; }).join(" · ") : ""); }]
  ];
  function trDates(s) {
    s = s.replace(/\b(\d{1,2}) (January|February|March|April|May|June|July|August|September|October|November|December) (\d{4})\b/g, function (m, d, mo, y) { return d + " " + TH_M[EN_L.indexOf(mo)] + " " + (+y + 543); });
    s = s.replace(/\b(\d{1,2})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2})\b/g, function (m, d, mo, y) { return d + " " + TH_S[EN_S.indexOf(mo)] + " " + (+y + 43); });
    s = s.replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) '(\d{2})\b/g, function (m, mo, y) { return TH_S[EN_S.indexOf(mo)] + " " + (+y + 43); });
    s = s.replace(/\b(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g, function (m, d, mo) { return d + " " + TH_S[EN_S.indexOf(mo)]; });
    s = s.replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December) (\d{4})\b/g, function (m, mo, y) { return TH_M[EN_L.indexOf(mo)] + " " + (+y + 543); });
    return s;
  }
  function tr(s) {
    if (LANG !== "th" || s == null) return s;
    s = String(s); var t = s.trim(); if (!t) return s;
    var lead = s.slice(0, s.indexOf(t)), tail = s.slice(s.indexOf(t) + t.length);
    if (TH[t] != null) return lead + TH[t] + tail;
    var up = t.replace(/^PART ([IVX]+)$/, "ส่วนที่ $1"); if (up !== t) return lead + up + tail;
    var ic = /^([⚠✓ℹ▶◆★☐✕•●▲]\s*)(.+)$/.exec(t); if (ic && TH[ic[2]] != null) return lead + ic[1] + TH[ic[2]] + tail;
    var r = t;
    var more = /^\+ (\d+) more$/.exec(r); if (more) return lead + "+ อีก " + more[1] + " รายการ" + tail;
    for (var i = 0; i < TH_RULES.length; i++) if (TH_RULES[i][0].test(r)) { TH_RULES[i][0].lastIndex = 0; r = r.replace(TH_RULES[i][0], TH_RULES[i][1]); }
    if (/[A-Za-z]{3,}/.test(r)) THF.forEach(function (f) { r = r.replace(f[0], f[1]); });
    r = trDates(r);
    // "Phase 1 · Go-live 4 January 2027" style pieces separated by " · " → translate each piece that is a known label
    if (r.indexOf(" · ") >= 0) r = r.split(" · ").map(function (p) { return TH[p.trim()] != null ? TH[p.trim()] : p; }).join(" · ");
    return lead + r + tail;
  }
  function unesc(t) { return t.replace(/&nbsp;/g, "\u00a0").replace(/&#(\d+);/g, function (m, n) { return String.fromCharCode(+n); }).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'"); }
  function trHTML(html) {
    if (LANG !== "th") return html;
    return '<style>.psr *{letter-spacing:0!important}</style>' + html.replace(/>([^<>]+)</g, function (m, t) { if (!/[A-Za-z]/.test(t)) return m; var o = tr(unesc(t)); return ">" + esc(o) + "<"; });
  }
  function stageName(s0) { return LANG === "th" && s0 && s0.th ? s0.th : s0 ? s0.name : ""; }

  // HUMANICA stacked logo (navy for light backgrounds, white for dark) – from the brand file supplied by PMO
  var BRAND = { ratio: 2.1608, hratio: 7.1859, hn: "data:image/png;base64,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", hw: "data:image/png;base64,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", n: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAjAAAAEDCAYAAAAr9z7xAABJAklEQVR42u2dd7gjVfnHP5PkLru0pS3Si4D0XgWkSBEWUASkSlUUkN5EBZEmFpoKKPwoglQpFjqIdKkLCIIU6UU6sgK77CaZ3x/vOd7D7CQ3uZncO5P7/TxPHpa7d5PJzCnf89Zo7FLjEUIAUAIioOb+fxZgLWBtYGVgPmAmYAagAsQtvGcETAY+Bt4HXgAeBR4EHgbeDH637P5b06PILWnPaD43PlYFlgcWcGNnDDC6jXEyxY2TicBLwATgduBeYFLw+fUW31OIniaSgBHifxuD35RWAPYAvgws2MXPfMsJmWuA64BXAyGF26hEfsRt+EwWBTYHtnDjZbYufvbTwNXAb4FnUsarEBIwQozEOeA2pxqwEPAjYOdgw4rdphW5V/jvWj1Zx8F7+f+WEu83EfgjcCZwv/tZxV2XTtv5GB8AXwS+A2yKWVhIGSck/tvJOCkHvzMZOBs4HnhbIkZIwEjAiJG9OUVu49kNODk4SVfdBhF18fPj4ERfDn52EXAs8C+dtoeVihsHYK6hY4CvBH9fDQRON8dJ3b0q7v9fBvbFLHcaG2LEUh49bjHdBTHSxcupwE/cibrqNqRub0rh6b6UOMEvD+wK9GFxEJ8EvytrzNC4E/3zGOfE5NnAMoGYiNzvDeU4iZ1YmRXYAbPI3BVcrxASMEKMELdADFwIfDs4TZeH+Zp8EPEYYH1gG+Bd4PEUl4Ig8zgX7y6KgD2Bi4FN6HfnDZVoaTZGfBDvRm6c3CIRIyRghGDEuAZqwOnAN4GpmLUjIj8bqT9tjwO2xrKhngFeCb6DNqzshEEYb7ShEy57A2MDQVPK0fXirmsdLEPpbvcdFPgtRlxkvRAjyT1QdcLlO4F4yeumWncb1UbAPcAZwLzuO8gik527qAoshsUf3QKsEQiaco7EbTg+/Fj+KWYlqmo8CAXxCtG7gj0GPgv8HavRUcrh5pRGLdic3gJOdGJmqtKuOxoLMVbb5yDgEGDm4OdFOOD5eJzXgOWAD4LrF0IuJCF6aNOqA+cDyxZokwqtpTW34W6C1SB5HasTEiO3UjuWCy/2dgAuwWKNpnP3tyiiliBmahZgFHCj4mGELDBC9GahujUxV0y9TfFST9SDaXeDiFOCdekw/dpbZP4AHI0F+pJI/xXTulzAXETHYfEuZCRc4iDAdjDjJAqsJ+24rfy/mQIsgVXxLckiJxQDI0Rvsd8g3C1+c6sEWSjlNl+V4N/7U3M9AytCHfgqcB+WCj5bDjKq8hznMi9WLPBuJ15qgRiMOnDj1IJ7PthxUgr+fdRGfRdfDmA08C2t7UIWGCF66/QdA3MCz9If5xC1uDmVsDL/v8f60kxuc7OLMRP/iu7kvzLmrsjq5B/Gx7zkLAvnptQ0Gcnl//uwoO3vuXGQvG9ZWML+CzyEVVJ+zP1/u+NkRmA9YFus3kurlkL/e88DSzlrDHIlCQkYIeiJiqrbA5e2sXH53zsfOAyrx5IFi2ExF3thjf+y2kxrQbXWe4AjsWaAI60tQbL8/+ZO1K2Q0b1OvsfTWED1H+lPc++UBbA0/y3aEDFelK/hRJSq9Aq5kIToEb7QRoaG36DOxRo7vhu4BsoduJAizAp0ImaR+SlWxyN0CWWRdr0WcBtwAZZ1NVLSrsuBmFsOa4J4jRMvtQzuQfge7wM/wCxqv3LipZRwFw52rLyMNRO9ISHGBro2P84pUCCyEBIwQgywsC/TYkEy7xZ4Edg/qNBade81mFc1EBF+k3sPOAJYFbgqUQk27mBOl4P32AVza3wfmD5wWZV6ULj4uJHZsHig+7D4oHqGcS7+Pc5zAvTHwEeBOK0Hz7qTseItaXtiqdHttJFYQVNeSMAIQc/Ev1SA+drYrHDWl4+7kNFRDwJtK8ATmEvpy8AjwSZZzWhDnxU4AeurtG1GG3qe1rBQsH0DeBj4LlZmv1PBFgf9scrAHcC67nNeCoRLNWP3nBcxrwFXthjU65/l/KoLJCRghOgdZnKvVkzrfl7cPciU6cFsjiXM1bEGVlTtreAUXssoA2cJ4HLMLbFqsOlXCihkki6z9dzzOgdYMCOXWS34nJecaFkPuDPIGqp2Oa4ocp/Xyrj1fz82sAYJIQEjRMGZjtZaBoTF7d4doqqmoUVkCnAa5p44M3Bb1DKMj9kEC/L9FTB3AeNjQlG2CBbncxsW9+PvU6VDd5F/Hh9j7qgVMbdRlMHzoM36Lm+1GdMyffAsFQcjJGCEKDhxQWJ1vNh4HUv7XRO4OaMTf+hu6QP2xdwt+wZZSnmOjwljhGbAAmgfwuJ84kS36E4yufznXIlZqr6HBeyGAcJCCAkYIUSKW8mf9B8AvgTsiGUvtVvkbKBMnbkwS8z9wPicxsckC/dtCzwIHI/V16l1WLgvec8nAJsBXwOezOieCyEkYIQYMUImLHJ3KZau+0NgYgYF6qKEkFkJuA64AiuEVsuBWykK+jvVMGvITVgcz5IZpkX7z3kLOBCzel2fyD5TQTghJGCEELQXj+E36f9iBdlWAi5KFGyLM7JubINZfU7IyLpBBnEu82BF3f4GbJxh+f960B/pDCz9+BdYHFKndXmEEBIwQoiEpeA5YGdgA6y1QTmDVN5kfMn3sfiY3TKKLxnMdVSwOjwTsHigSkZxLmHm142YxWVf4N9yFwkhASOEoKtp12Xgr8DawLexXk1Zx8csjLVRuANYJ6MMH1q0BI3HCtH9AovTqQXXl4UIfBrYAdgUi6cpd6meixBCAkYIwbRVYevA2Via70lYo8ks2hKUg89Zx4mYc4GFupB2HYqmpbDsn+uwmJ8s4lxCN9xELI5oFeCyjKofCyEkYIQQg2iRUAHewRpOrg78qUttCfbA3DlZVbklsBjNjJXlfwDYOqNsqGQg9IVO6B0HfKg4FyEkYIQQw0vYluAxYEvgK+7PWbcl8H2GHsxAaPj1Zw/gX1i9lRkyLP/vLUn3AF8EdgWeV5yLEBIwQghyGR9TAv6MWWMOw6wzWbclWJp0V09lEMUF38JK9Scr0NJhnMsrwLcwF9htQ1j+XwghASOEYPDpwZOxuJgVgLOCn2fZlmA8lt58GvCZwNJTbkPAXIvVeNkz0SCx1uH3Xgn4v4y+txBCAkYIwdCmXb8G7IVlLN3ahbYEo4ADsLTrfYKft+IGigP30zmYNednwKQWY1SS5f//6MSQtzyVM7A8CSEkYIQQDF9bgnuBDbEaMs91Ie16Hqwg3L1Yw8hW42PCTKN3sSDhVYGrBghGDr/b37G4n68C/1CcixASMEKI3mtLcBHmXjkWq+6bdVuCVYEbsDTlJdpIhQ6r/j6BVQUejzVsDAOJk9lXhwJrYHE/Kv8vhASMEILebUswETgac9lc2qW2BNth2UrHAWNbbEuQdAndgFXK3R+rlFum30X1Gywt+mSyqX8jhJCAEUJQjPiYZ7FO1xtjHamzbkswI3AkVj9m50RbgqjFoNypWMfslZxoudWJmr3JrgKxEEICRghB8doS3AKshfUcer0L8TGLYIXkbnefE6ZdRy26ld5womVDrOCdyv8LIQEjhEBtCWrAmVja9anAJ11oS7AucBeW3rxAi20J4kDIlDJydwkhJGCEEPRWW4K3gYOxwNhrMwqMDdOuAb6JuZUOA6ZrMe06DuJ4FOcihASMEEKQlpr8KLAF1jIgTE3Oqi3BHFjNlwex9Ocs+h8JISRghBAo7boEXA2sBhwBvOeETJxhW4Jl3Wdcg7mvahl3uxZCSMAIIRiZbQkmAT91AuOcQIRk1ZagDmwO3IelRY8LBJKEjBBCAkYIQacNEvfEGiTenmFbAh+UOx0Wf/Mw1v6glEF3aiGEBIwQooeJ2mhLcDewPrAb8HwX0q7nA36NNYrcEMXHCCEkYIQQTVoBtJIJFLYluACr5vtj4KMM067956yO1ai5BFhc8TFCCAkYIQQJsTB9ID4qLVTK9ULiP8APnJC5fIAGjIOpHxMDO2DZSj8CZkrUhRFCSMAIIRhZVhcvBPYEHgd+ByxEawXmSMTHPA1sD2zqxEZWbQm8a2omrH/TBKz9QSy3khASMEIIRqTVZV3gHuBs4LPA17H6L0dhfYxasXQk2xLciLUL2A8r/591fMxiwMXAX4BVAkuP1jMhJGCEED1KJWiy+Essk+jzgQioYZ2jj8WsKNu1YekI2xJMBU7H0q5/6f4/67YEGzjxdTzQF1yjEEICRgjRY+KlirUIuBezkCS7Q4cF5pYALgNuwgrZtduAsQK8CRzgRNL1XWhLMAqLv7kDWMr9rKJHLYQEjBCCnol3qWKxLrcDyyTSopsVmNsYS2c+E5g3EB+lNtKuJwCbAdsCT2bsVqo6gXQ3sJX7f4kYISRghBAFFy8+I+jHWKzLdC1aKsJsojKwNxYfczD9LpuozbYEVwCrAt/HspfKHTZnjAK32KzAVcBBTsQouFcICRghRMHFyy+B77WRXUQDS8ccWKn/p7BGj62uI2Ehuo+BE4EVgfMT1xl3YI3xn3EKFsNTU0yMEBIwQojipkn/Aot3mZqhVeJFrLEjHbQleBHYA8uEujODtOtS8O+Pwqw8cicJIQEjhKBYqdJVt4nv78RL3yDFSyg6ngC2oT8DaDDun2Ta9Z1OxHwDeKnD+Jgw3ucEYPfAnSSEkIARQhRAvGzuNvHBWiHCarvvOzG0GhZnkkVzxXoiA+o8YCXgJ1j368GmXYfWp7OwmBu5k4SQgBFC5HxO14G5nSCIA9cKbVhIwn5H5zthcSIWv9JpPRdSLDxeKL2HxeqsAlzZQVsC/337sOrCM7p/r6BeISRghBDkM/YlBk4FxjmRURqEu6gM3AWsg8WpvEg2qc+tuqqeBL6GWZEeDaw09UFYohYHjhnEvRBCSMAIIRga11ENWA+roNuu28THikwEvoPFpdzlftZp8TkGER9TAq7DCu8dBUyh3xrT7j3ZD6t9o2q9QkjACCFyhhcXxw7i3/o4mQewonBnJgRAfYi/S5h2/QnWLmBd4JnAskIbFqk+rGJvrGEihASMEIJcWV/qwJrAF9q0NHjx8nvMeuMr5cZddBcxCLfSfViTyNuCtgjt1LHZClg0iO8RQkjACCFywjfot2C0KhAqwKWY22lSmxYOhsiy5N1b7wDjsf5MlRYFVhT0TdpFa58QEjBCCHITuFsDZgA2pd/q0Ip4KQO3AjslMn7yiL/eyVhPpccDy1Ora92WgVtMCCEBI4TIwTxeGUufjlvsURQBbwFfD2JD6jn/rrUg0HgHzGJEC7Et/h4tibmRYq1/QkjACCEYdgsMWJE5WrQu+JTio4E36O8+XQRqWFDuE1ibhFatRt5dtrLWPyEkYIQQ+WEpWs/wKQMvAxfk3G00UHDvLzBrTKUFK4z/+6U1VISQgBFCDD/ecjI/n7bIDPT712IumFIB04vr7nu+gfVSasf9NX+LbichhASMEGIIBMzYFgWM56GCl9b3rQ4eaVGQ+O86i4aMEBIwQoj8UGkzZubDHrBCxJgLSQghASOEoJhBvJ+0WbF3zh5obhhhPZ8GU7FYCCEBI4TIwTx+r80Nek33u3GBXWcx1vqAFlPHAd7VkBFCAkYIQW4sMC+3KGB8kbtNgTmCgNiirV0xVtdlDffnVlsnvNBmrJAQQgJGCNFFHmuzcu+swEFtbv55EzDfx2rC1NsQeo/LlSSEBIwQgtx0ob6vDTFScpv+wcCK9Dd0LAJ97no3w1og1Fr4zv6+TAIeloARQgJGCEFuaqL8A/iX+3O9RWvEaKwL9bigYSI5z7SaCnwO+G0briAfL/MQ5morFajysBBCAkYIetUCU3Yb+9VtFHXzFXgXBa4DZg/K7ZNjy8tngRuw+J1Wexr53k9Xau0TQgJGCEHuitmd74RMuUUXSdmJglWB2zDLhncnRTlap7xAWwX4qxMxtTbESxn4ALic1vtFCSEkYIQQQyBgysDTwFUtupEI3DI1YFngbmBrJ2LiYRYyUdBksgZ8A7gdWLDFuBcSfZPOA95sQ9wJISRghBAMjSspAo4FprQZqFp2G/04zM1yDjBPIGSGOjbGi4wqsAhwhbumGQKx1uo9KQHvAz9z90fiRQgJGCEE+bLClIB/AqcGoqRd0VDHrB0TgH2x2BNv8ej2mlGiPzZnRuBIdx3buJ/FbV6DdzMdhTV+VPCuEBIwQogcu5KOweqdVNoUMVEgIOYCfgXcA2ziflbvklspctddd6/tgQeB47AmlV5AtfO5PpbnL8AZgxB0QggJGCEEQ+dGirF6JzsBH7cZD0PCGlPDAnxvwNKtl+yCWyn8rNWAG4FLgSU6+CwvtN4AdpPrSAgJGCEEhbHCPA7sHFStjTu0inwNq6NyAlbFtxb8Dh1YXry150zgb8CXOrT2+Lo4U9w1vybXkRASMEKIYuDruVwN7BMIkbjDuJTpsfL9EzDLRtxBfIwXVntj/Yn2DgTNYONt6oHFaVssq6oi15EQEjBCiOLgY0B+HYiYqANLRJgZtDBWc+Y2YO3AYtJOnIrPmnocq+1CB9aiMGC3igX9/sl9/6qGghASMEKI4oqYHYDJwSZPBrVZ1gPuwmqsLBRkCpXb6OF0N9bX6KtYQ8pKYIlp53uWgffce/1R4kUICRghRG+ImMuADYDnArdK3GF1XP8eu2NNEo/A3Ey1wPXUSp2WkhMdqwGHAG8FIqg2gMvIu8seBb4A3CLxIoQEjBCit0TM34A1scJw3t1T7TCDyL/HrMCJwP1YNd96i26l8Pc+AU4BVgJ+E8TD1BKuL+/K8kLqbMyV9WTQHkEIIQEjhOgREVPGrBvbYlaTN5ywiTsMdA3fYxmsmu+1wIptuJVqgYvqNSyody3MolIOAonD33se2Ar4NvBR8DtCCAkYIQS9lZ3ki9X9FlgZs17QwNJBB2nXm2HWmNOAzwTCojyAS6kavNf9wMZY/M4z7mdlLJbnJKy54x/oPEBZCCEBI4Qg/8XuvMvmdcx6sRZwa8LSEWfQDqAPOACLj/kO/bE3A6VJx0EcTYTF76yEVea9EiuudxjW46jc4fUKISRghBAUzxpTBu4FNsSq9z4bWDRqGTVknAc4HWtLsHEbherqgfvpI+CHWHG6f2R0jUIICRghBMW0xoSWjkswt8wxwH8TDR7pIO06bBVwE2ZRWbyNVgGh2CplYCUSQkjACCHojfYDXkhMBH7khMyliQaPcUbxMdthbqXjgVkSsTkDia26Yl2EEBIwQggaWDqeAXbEXEv3JVKms4iPmR74AdZfaedEbI7WJiGEBIwQgsG6lcpYcO9awF7AqwyuUi5N4mMWAS7E2gms2WEjRyGEBIwQArmVaoHYOAtLuz4V6/Rc7tCdk2xLsD7WVuAcYIE24mOEEBIwQghBmlspDorgHQysDlyTUUBt2JYgAr4BPAIcDoxpoy2BEEICRggxAonaiI95FPgy1oDx8QzTrsEsL7MBP8UK2W1J620JhBASMEKIESRcvJsoaqPAXNiA8XDg3eB9smpLsCxWaffPwPJtdrsWQkjACCF6lFBwzJ7IBGq1AeNk4OdYpdxzAkGUZVuCLYAHsEaPc7bYlkAIIQEjhOjBue9jV8YA38U6OV/PpxswDpQJFDZWfBnYE+sKfVsX2hKMAg7C6sfsFYgkpV0LIQEjhGBkuIu8ZWMrzLLxE8yysSlW8+UXWAPGVjKBkg0Y7wG+iNV2+VcX2hLMC/way1jaUGnXQkjACCF6mzC2ZEUsruQqYJlAqHhLx/6YpWPfoAFjqcX4GC9YLsKq+R6P9THKKu3af84awC3AxcBiSrsWQgJGCEHPxbngNvg5sTou92FxJfWE9SKMiZkH+JX73fFtZAKFgbYfAEc5IXN5RmnXoRUpxqoFP4z1b5q5xbYEQggJGCFEjue3jxOpAPtg6c8HYlaWRlaVpJBZGbgOuBKz1tQG0YDxKWB7rBP1Axm2JfCuqRmxTtUPYR21Y6VdCyEBI4SgcHEuYYXbjbG4lDOAudtwtSTjZbYO4mXCBoy00ZbgFqxdwHeA17rQlmAxzHX1F8zFFIotCRkhJGCEEOQ7Ldpv5pcAN2G1WlrNLGqWCTQay1h6AXPdtLqOhG0JasCZmGXnl8DULrQl2MCJtrOA+VQ/RggJGCFEfueyt2SMBY7D4kJ2yMidEieq9d4KPJ34O1psS+CF1pvAAZil5PoutCUoAd/C2hIc4sSX2hIIIQEjhCBfadExlro8ATgSiwvpNKA1TsSy3AdsBGzjPicepNgI3/NhYDPMRfVEF9oSzAGchLUl+HJK4LIQQgJGCDHEcS5eYKyJWUUuBBbJKKU4FBmvYsXj1sTiS7IoHpdsS3A1sCrwPeC9LrQlWA74E9aaYFmlXQshASOEYNjiXObH4jzuxorHZVHULUyX/gQr37+S+xwyaBPQ7PMmYUHCKwPndaktwZbAg5hVZpzaEgghASOEGLry/6OxBoqPYnEeZFBW34si/znXYvEphwBvZ2QRoUWLz4vAN4B1gDu60JZgOve9Hnb3r6S2BEJIwAgh6FpatLcg3A/8FJgtUca/U/FQAR4HvooVuns0o5iUwbiVysBdwHrAbsDzXWhLMB9mWbqL7CxYQggJGCFQ+f/+zXZ5+mM4lgtiOCodChcfB/IOZtVZFfhjRllBdOBWCtsSXIBV8/0x8HEX2hL4GKLfAYsqPkYICRghROdZNOOAk8k2iyYUCADnYHEnP8fiXjoVCGToVvJC4n3gB05gXdGltgRfx9xKRwMzqS2BEBIwQoj265iUscyfR4CDsbiNTuuYJF00t2NxJnsCL2dUGbeb8TEV4ElgW2ATrHVAFm6lsI7OTMCP3HvvoLYEQkjACKH50Xol2Y2wzKJfA/OSfVr0c8AuwPruc7LoTcQQxMeEQcY3AZ8H9gP+HdybrOJjPkc2lYzJyBpHG9a1WNNXaIEWojeYhLlGBqocG57k53b/Hw1hWvSiWC+fm/l0L5+s0qI/BI7H3EW/S6QpF2XTC79PFTgdS/P+lfv/LNsS1LFeUn/D2h/MO4TxMX7szRt871b4KBjDEjJCAkaIgvMh8EGbZfM3dX8uDUH5/5kxt8XDZNdNOVko7nIsfuQody+6nRbNELqV3gD2xywyN2bYliBMr94by8o6iGzcea0+w00SbRwGGrfva30XEjBCFB8vQOrASy2eSstBWf55sGaDFbIt/Z8MHJ1AdoGjyfL/Dzoxtj3w1BCnRQ+VW8l/14fcd/0aFivTjbYEpwD3YmnmoTUoyxiZPvd5KwKbtyik/bh+Xuu7kIARorfG+aMt9u6J3O/MisVATB+4JiodvEqBuPCpu7eQbepuKFxeB74TWCXKw5gWPZT1Y0rAlZi16QfOIpF1W4IVgT8DVwHLBM/UC41Ox8lUYC7gYidm4jbE0cOa8mIkUB49bjHdBcEIKATn40i+3qI5PnIn64WxgNp/AK8EJ+7BvGJgTmchOB5LWf5sopR9FnEuU4Ez3He9PRBFtREQExEH33cKVqDuCmAWYIVAwDHIex0FFr0YWAqrGLw4FmP1NhZv1ek42RD4PbCE+1mpjXH+PXcdioERvb2wj11qvO6CGCkCZibgGXeybXVTCGul3A48APx3ENcwJ9ZAcDmsem7a+3diefAuruuBH2IuqbBv0Uh97qFgWdcJx7WDe1/q0O2TfH5vAI85wfv+IN5vLPAFYPVAmLY6TkuYlXGVDrqECyEBIwT5KwxXA04DDsDcNZU2rBuljINPyXjzfAILAr4y+L5Kp502WBpgdyfyFspQRNYzLngXtxlA7r/DAcAv3diu6tELCRghemMTq2O1PR7D4graSZGOMxAEUQaiJWk5eA/4mdu0JgUbXl2PPFXE+mc4G3CY2/DHBPerlIHwyGKclNt0H0bAW8CSwH/kPhKKgRGCnoqN8P1+xtFfY6XUpvjo9BVlVP8kAs7HUq6vS9Q/0cbVPEunjPVTuhXrLTUXFssSBUHQg31OWY2TwVjifoB17q5IwApkgRGi52IiIizO4O/A/F1wD3Vr460Hp/K7gCOBO+nPjqlJuHQUHzMeOA4riJeFW4khrIXjU+XXCsaBxoJAadRC9NYJPMKCK3fPyNw/VMXaysAL7rrXceLFp0VXtWF1nHZ9PWaVOxB4M6O2BAxBReISVqRxFyz7TK4jgVxIQvTuxlXBegG9gxUJqw9Ry4DB9LPx7o6fA7sB9xW0/H8R0q6rWMfvS7C4mJUSWVx5Gx9+zG4L3BO4EIWQgBGiR/HumPuxWiEbdSnbqFN3UYRlFe0EXAZMDuIbJFy6Y52rYG0WrseaOC6IFRnMIj4mK6qBhWh3rEVEZQSnywvkQhJiJOFrp5yIFSL7JDiFD8cptp5wFz0MbIaVxH8i0S1aDE1bgvuxRo7b8ekWDMM5Rnz6/ztYK4MLlDItkAVGCEaiJaaCFX27GVgeC+yNAvdMt07ccZBVVAqCSl/Gmi1+G3g6+Du5Boanh1aEFaX7LebKWxYriBiltCbo5jiJg5inm4GtnMCSeBEoC0kIFbnrw3oHHUB/kbMwfZkMLZ9J6+cEd5q+iP4KrmW5BXI1PsBSrnfD2jQs3SDNvVvj5AngJCemND6EBIwEjBCfKnQHMDOwNda9eQ33/1kzEXgcq0VyLZYGi6roFibtuow14/wysD5WR2ZMFz73XeBuLLD4T5irM5JVTggJGCGabVIA82JNAJfFGjvOMghXQYQFC78DPIvFUzwB/LtJpViR3zFSTnHbLIBZZJYAFgFmH2QdmTpmgfsXVjH6ETdukNVFCAkYIVrdpLJ2CQzX54juid2hCKwO46AkboWgv4KnEILUbJRw84gyKBIWpQRmKgCz2IXwGIJxInErhASMEAzGpC+ExokQqA6MEEIIIYQEjBBCCCEkYIQQQgghJGCEEEIIISRghBBCCCEBI4QQQgghASOEEEIIIQEjhBBCCCEBI4QQQggJGCGEEEIICRghhBBCCAkYIYQQQkjACCGEEEJIwAghhBBCSMAIIYQQQgJGCCGEEEICRgghhBBCAkYIIYQQEjBCCCGEEBIwQgghhBASMEIIIYSQgBFCCCGEkIARQgghhJCAEUIIIYSQgBFCCCGEBIwQQgghhASMEEIIIYQEjBBCCCEkYIQQQgghJGCEEEIIISRghBBCCCEBI4QQQgghASOEEEIIIQEjhBBCCAkYIYQQQggJGCGEEEIICRghhBBCSMAIIYQQQkjACCGEEEJIwAghhBBCAkYIIYQQQgJGCCGEEEICRgghhBBCAkYIIYQQEjBCCCGEEBIwQgghhBASMEIIIYSQgBFCCCGEkIARQgghhJCAEUIIIYQEjBBCCCGEBIwQQgghhASMEEIIISRghBBCCCEkYIQQQgghJGCEEEIIMXKpJMRMBMTBq2hEwSsG6kP82V4Q1gt4//zzH47rD+/dUD+3kXrP9Qx783sM9/UXfR1sdX9pRLh39tJ3z+OeSyX48HrK4lov2I1MCq/SEIkxf69qwc/Kif/PM2nXGg3RBCz6vcvynpcKuvGnPcMifpeij8Xhvv5emstR4lBfG8ReUkrsQfUeFC/JexINpXirBBewKLAY8DYwwd3sqCAqMrzOlYE5geeAZ4bos+tAH7AGMAZ4xN3HIty/yE3OhYElgHeBB9x1d/v6/b0ruXs3E/AP4LUCb+atLmw1YB5gWeBD4D73s6hgJ7dw/K8CjAWeBl4o4GJcB6YHVgzG4qsFGYv++ke5NXBm4EnglSEaU6Xg/q3iruNx4M2C7SPeelRLEV6zA7MCs7n7Ww7WySowEXgP+MCto/XEuIncv6n3wNoWPtOVgM8ALwNPDLUFZjrgVGAP92fcBrazEwB5n7z++hYCLgS+4H4+FfgdsA8wpUuq0H/2Cu6zl3U/fwc42H1+nu+fv7ajgcPd4gNwm3v+r3fx+v37LgpcAqzqfv4fdz2/7FFLjP9O+wLHAbO4nz8E7Ag8WyDx1mj8TwJ+BRzRwLqb1++xEXCmG5O4jej77mcVt0nl+frXAM4BlnY//9Ct7T/s8pjy770pcDrwWffz94FjgF8UYB2MEqJlFidk13Ab9OeAeZ1ArzR5Ly9k/g28BDwGPOzm9wvBGAo/s4gHsNjdj4uA9eh3GV4B7A58MhTej2jsUuNPcJM09FmWgfuBtQpg+vID4Q53vbXAjFVym+GxXViA/GfMAPzdTdpasEnhTiITcjp5/Ua6PXBpcOrwf3cDML6L1x65U/vf3ImxGpxQALYE/tRjIsZ/ly2APwf3PHbj8xG3YE4tiOUuAka7RXqRYO75U+zXgYtzvvn7eTzOWY5mSZnH3wDOy+n3iIIN9wlg7pTr3x64vEtzya8PCziLzwwp42AD4K85nMtJETErsDHwVWAddy8ZIM6l1aSYyW5+X+PWtScL7Gbzz/xG4EsJy3EZOB44aijmS8ltFF55loKLW9kNynqOs5VC68vnU75DDdgkEGfdUKFrO/FSdQ+v7DYggO0KkO21i7s3U921e/fGxm5T6sbz96bX5dw4qwX3zo/Fc4EFg2dKD7iN6u7Ucm4wPstuotfciW/5YCHIuxirAzu4cZIcP3Xgu+671XP+PWJgdScCwnnsn9FZ7pRZHeD0PZyn4RXchptch+rA5kOQyfoFJ17CceCF+AYJsZUH0Rc+36WB0zCX4WVu3Z7b/X01GM9x4DIqpbxIxLvUgn8/2u1RP3ZC5nrgK8EhppSj+9PKvP+CEy9Tg+/vxeB3MHdbrdvfqRQsllHKoBxTkM1hdMqiHyX+P+7SyWf2lPf2anT6HN+zOLAghRMwChbAsV2+hrHBghAlTo2zY+bJcguR/xTIt36hO+2njdcY860XJV6kgrlK44TI9KJgWWCz4HeLsIZEKSf0CmYaXzQQCHmjL+X6/bgbins/c4PPz5sLsRwE5S4J/Bazkh+AxaTVAquov3flRJZNtcGrFnzXUnA4CT+zisUHbQr8EbjH/blekIOL3zcOTcmkLAWWrG8OxfcptRikQwFu6nBtcPUGnx0VJI6hPsi/y4JGCr3sJvrawImBpYICu46qmFn1i002wahgsS9bAEs1WajiYKGrF3QN8RalOdyGM0tOrdJxDkR+ng8ZUWDhnRn4KRaXsisW+1kNxnE5mIvVhEvMi5K0VzlhDKgGYigK/m0ciJ01nTXmYsw6m+e1zgux5d3BJG3ee92wLzBjt60weT8V0QOR2rrGwX22958eBtyNxYwUMR7Gi5f1sXisasHFWLhZHt7EuulNzWtj8QR3FjieqRy4Gq7E3NJxATPGGMEFW71o2AwLbF4s4b6pJA5WBK4w/7NXsUybV7Bso4nu56Mwa/I4YH73mrvJe4beAb/B7+gON3thMTJ5DXqOgYOCda3SQPDP577T2d2MhZGAEUU46Z+Dxcq8UrD0an+tcwAXJNx0FDwQeX0s4LjeRJD5zf1wJ2DoASvaBm487hbELknE5H+8ljFr7mGBdaScGLu1xM9exYKPb3bWmpexDDtacI0vjGVWbgSsi5X2SH5O6DKvAnNhVr59gTNyttb5a1kY2HYA95AX9gcC5wcJGrFaCYiReHIaR39KepHiYfz1n+tOZb0QkByKkoFiy7zJeRMsyLRecOtTBQta3BXLbKzqEFgI8TInljFzWFCDpcK0VbD92LwW2BqzuO2KuXeeduIlauJG8taVD4BHgf9zm/1Szhpxc2Je1BNjy4vhU7EEhjy5Kv1ath8WG9vMNeTFzpJYoHLXYmEkYERRTr7rAicUKB7Gm00PBr7cI64jv/CujGWp1VMC5eOUOKcyFgsT90j7FR/P9E0naCRi8iteFsVKbGzonlspse+FGUBXYplCWwBXYy4iL1aSVXkbBfHGieDpMlbU7lIsa2dN4Krgd0ILXjkoCrlsjqy1/jo/g9V4SRMkcYPDzmHdjO2TgBFFEjFHYD7svIsBf72rY8GCtR4QL+GidEgD83aUYir2omdrupeWzzAFg56FWZdkicmneFkcuBWrMJ58RnGwET/ixMXXsIrYpcCa4sVKO32d4pQAYB9Pcy+wDeZaejD4nKoTw16wvJCjfkre+rIn/UHs0QBJP37er+bEY1esrxIwokhpyDGW9phnd0yYDn1Rot8YPRCPtBiwVeIU5heul9ymHp64oqAOxoE5yZYZjGiLGzSwuxzLyqj2kEjthTYdCwA3uf8mxUs9eH4nYrFcNwcio55xbFOYdeTF0V+cNeZorGptxVleSu7Q80ROYmD8/J0J2LvB/P0Iq6MTNbDKHNYtMSYBIyhgQOxFOY6H8WbgM4O6IaUeikc6EEs7DX3gPsPiCixD4cPEicyfxnbBAhWLZoVJG2d+PM6MZY3M00NFF4ue9TkzlrW4YIp48c/oHazA3/exVjPlRB0Xuli2ohZYaY91VopjgJ9hrtk8teAI5+48ibnrU8/vwqyyTydie/xauIH7jpnHwmiyCQroSlrHTfi8uWb89e0J7NRDrgV/qp0baw+QtL6U3SnyXCzQ8cJEifYo2Oz3Til8l/eA5Zfor2obp7gqFnQiZsYCfbdePuScT79VrJISj/WsW0OuCyykQ53eH7qWHgN+hFWuviVH6fn+vkwH7N+k0OOv3H0/I+XaveA5VBYYMdKIm4iEI+mPP8iDiPGb2TJY87pak+JucUGtL/s4EZK0vkTAH4Cn3J9/4QRNOfiu/j2+jaWZ1si/Kym0LO0bCLm08bgKlq1Cj7gMixr3ciDm4pzaQLw8jcVk/DMIyB6u+Rgn6tBUEnMmL9aXrbBmlvVEXZwSVsX4JvfnC7AmlqUU6+tXsFikTK2vEjCCgrRsT4uHuYBpzZrDaboe4zaxMQ0yCOICbm7+FDYL8K0UC0MpSP3ELcLPYPUs0qwwn8FqqMQFihmZBSvI1aiho0+v/rI7jdZS2rOI7lsIl6a/cncy5qWMWdI2xuq55KkxZz2RyUSOrmsg68mp7pr7sKytRjFwozD3cqYxcBIwIq+n3uuB2xqYd72peE6sPsxwn3r96e9UrEFlmlXIBw4+RX9Rt3qBUqd3c/e7lnIK+yvwQPBcIuCUFLHjBen+WFBvrWA1fb5Fv9uhmtKLqIo1sjtMQb3DcoA4w42r8Gd+4/0Y6zL9cs67o5OjcgF1J/hWShw4vLB5jv6UcF+s7mwnZNKsMDtiFXozO3BKwAhy6jZ6D4u3+LBBQJs33X8RC4QbrngYfx07YO6RtLiXOHjt5CwUFMCV5MXjGKyAVaP4jpMTvx85QXNbwu3iBc5nGbiaZ97GpB9/O2Bpt5Um7qSfAdsrvXpIDw/bYbWikuuA3yz3cs+tT+KlrR55aRlE3opyBjA5eAYlzIV0UYr1tYbFiO2bZZyYBIwgx2b717GA2FKDOgzDHQ9TCopl/bpJrQO/qB4FPIxVFi5S4bptnehI84E/gqWglhILVlLYJK0wBxewN1IF+C/mz381yLJI1oipY+7NdSRihsTFPAoL6k+6J/y8uxSz1HpXn2ht3q+BtQypJ4L2S8DbWEmLUKj4+/9L+jO7klaYbwCzZ2V9lYARecUXdbrMbYRpJ94wHuZ8LEtmqOJhvMuq4hbHsQ38u94f/0esknCpQCdAv3Ad1MBaFNHvAy+lZFjchJVUj1KsMMsD4937Vgrk3ixjPbm2JN066J//KMy8/jm5k7qedbQtVrQunPvelfmOG79F6qFGTqyOh6XEIfq5fS7wfkKk+Pv/NJbGnhYLM4cTMZlYXyVgRN4nUR+WXnhXAxHjF6a53Kk3DtL7hsJ07QthNYp7KQMvuklbbrOiZx7q2WzmxEY9xQf+AlZ+PWrgTvFxQY2exWEFigVKCtIJmDspLbOsFCzWfwZmU42YrgaZHpgyp/w6cALwpgRM2/N+KaylQlrJhI+xOleNatX4GDhS0q5jLE5shiysMJpQgoLEYeyEmS1LTeJhNsLqKXT7xOs/b3MsQr9Z3EsNi+V5r2CncL8hHNrg77wPfFKD1M9a0F/mxcRz84vkF9yraE0e/fO+1i3G5SbxMItjfXWm64FO5Hl0c6yG9eZKCzJ9CQsqLRXMVZmHuX+QOzzWUub0ZZgVMm0t9r9zL3B7gxi4BZz479gKIwEjimS23zVQ/Y3iYY7GIue7JWL8JJwXS6ttFJDmr/sI4J4G1qO8n8LSBEYcVDI9v0kRsPC0dkbKaa2drtZ5FjG/Bn7SJL3aNyI9P7iPEjHZZR5tm2LFqwexGB8nMmLEwGtbI4HhhfppA4zhZjFwBDFwfZ2uiRIwokhm+xuchWWgeJgL6E48TNis8AIsGDftM6pB3MtJBUzbTIqLesoJ6zz6rUrxANVGz8c68pZTOu9uAqxQsLowyXH5Pfr7XjWqEbODEzqKh8lmHlbdBrhZYi+Lg2DrS3JUkr9IBSvTXDz+z9cBjw9Qvdj/7o1YleHwd/28XxKrm9RRDJwEjCjaifcYNzFajYfJsj6MP4EcjfX3aBT3UqE/7qVovncvMpYDNk0sMK36wJNxCO86wZNc9Py9OqSgJ+SwkuoemMm8mSXmu1grBWUmZWN9WRLLAIwT2XFgzRLfUOxL2xmVjYJs/T0/pUVXqLeIN7LWhEHCdQkYwQgJ2ouwxmJpaazJeJijMqwP4993fSdg0sSLj3up0h/3UsQTYOxERbmBD/z3WHxBK5uDF5FnMm28jP/zNkybpl00a9VU9z2eThHXUXAvz3AnT4mYzj0Hq6WMQb9ZXquWDoOyvvg053rC+lLC4lrubDGmqBZ0a385JQYuBlZ3B8FBx8CVWli0KwV4ySQ7srIO3saqOtYb9Bbym8UxTSwlg/ENz441KqRBppMXS4dSvLiXVgrNlVrILGr0zF50wietwNVo0pvFUbB083exzI23GtSI8evtJVjvJLmTOmOFlPgpP/fvTRQgFAyYKDED5j5qNA9PbmOOpllr4yZJAnE3BMx7bpJNCXo15Onlr+s9jUFGWjzMXViMRrlBPIyfZBdi/Xc6Od3708l5NC6F7a/rSqyZYRHLlTcr9e9PYTcxrV+71fc+LcUiFrYqmCtx8iviuHwW2BprZplcmL01bgYsPmoBpVd3VCV2iYTVxf/8VeD5ggaHM4xu4x2B+RsUrHyK/toutTY7bp/r9ui09gIbOTE/qBi4ygALzh5YaeAopwPBX9c8MhUyEuNhTgY+7zaMWgNrwTxYPMwmgdUkbnOOVLG0wkamf38Cf47+ysG1AooX32xx1yY+8JMGkQ7sF8FHsaq9myYaHtawQoDfxqxmRe1V48fG3e4eXhZYWaKEhWBe4E9Ytd4PFavR9jgtu7md1vfoeScgdU9bn599TZot+g7zU9ucm34NeQer2ntwYv30ov9QrPUGWQiYKNgAjitwgJcYGe6kPbCA08VSLCM+buVLWDzMcW1OQP/vVwd+2iCexruwpmK1av7TIDanCKewKtawcJbEd/V/vp9pazu0Oy9PcgImrb3AXs5KMzHHh6ZWRczlzsLyMzc2+lLu9Qru9zZPZLiJgZneid40AfPvhEtUDHxA+woWFF1Lqafzb/ozumqDiBGLgNOxAPbRwc+8FearWL2kZ9p9ZqUWlFm1AC8VKRq5Ab0TnXr/pEk8TNWd7NdvI+7AbyYzY60C+hoEBfoJf5jb4CsFtb7UgJncIpOFD7yRFeY2+jtX11Kyx3YtaEp1moj5OfCrBg0E/caxKfCbhEVKDMxozBWXxtu6PW2vo4c2+bvfuHW2PAiBHVbtvrpBDNyoJtYfBfEKej0e5mHggCbxMKUgHmZci/Ew3opyprPuVJvUeyly3Evoj96Vaevn+D8/g7k8og4EmveBn9Jm/E2RCzDuj8W7NEuv3hNrSKrMpPYsB6Ma/N0nuj1tFazcALMy11PaBkzEqhl3mk0ZuQNQvUEM3E40ji8ctICpF+glGNHxMGdhfta0jcKf8OdzvzNQv6RwY9mpSdxLhU/HvdQLnIEwXYNMoLQOs51s6hHwByzYNbxn/s+LYOnIRbfCxMEJdidndao0aTlwHFYeYKpETFv3V2EEnZcAOCwl4NnP1YvovJ6Of69HgFsaWGFmpN/6m5mAKRXoJdRuYB8sQ6bZRjEeq5zayJXkf29ZZ1VpFvcyBXNf/afAFT/9CWirlDgi/+c3MDda1KF7zIuSKZhrJWrQhO+QgsYRNfL/f4x1r36xQXq1txyeE6T9S8Q05xOsrlAaY3V7Wp73qwAbNrCMTHFrYBaxWc3aC/hr+RYwazvW10qTSVfHitq8XIAspAWxVK2owLUkROcniUlOUDyABfnFKROlhnWo9c3GyonTAMAYd/IY02AyedfV/sBDBXYdhSLl0JQ57q1M/4eZkrP4nv5+Xgj8AJgzuAb/LFbAssauK/i9DTPU/o0FSt6JxVWFQtHHVvUBV2D9p55o4BIV/XP9Q6xybHKej1MKdcvr5qFuHFYTqdNlLG36mYzGoY+Bu9WtmaukZCL6KsAtt1+pDPDlbsWa6OWdBXIqXDSBhj4e5p+YS+fSlJNsFLx+B6yEpfiVgo2mihVqW67BSdh/zqVYfEyRN1i/MG3i7kWaD/y/WBBfVhYm35rgAyeMjmxQC+VwJ2DqPTQ2H8MKBF6fOCwSBDXPisUarQW8qUyahgfsyW7uLpRyyp8/pYeXYBqX+uewDKC0kglxYC3J8nP9+npxA2PEvkHV7gENJwO5Xsa6L9bn/pu3l7+uvJoMZ6DYaedRQeNhLsPS9hrFw9SweJiwm7T/3e2xeiTN6r08436n6JtLKz7wi4HXM/6uPjbkLCeQ0po8rgOs3UmZ8ZyOzZsxU7kXj3GK+3IRLGNjtFq+NN23XkgIFf/zzzohKGt8c8/FQVggdFrByjuA+zKuaeU/52osdjAtBm5B0jthDzqNuiiv4Vr8P2xyL8eQ/2qW0zeopVDHfKBFjYc5mMZpzX6j2Nyd9KtBAOlZDTbNMO5lR7fxFrnTrRcKawJfbMEH3g231avOkpWMrWkmrHpBxJwHHDtAZtKamJWwPkDA+Uhu5vhEg415NmBpib+m1pd5seDygQpWljLeM8vOetYsBu5gZ5yoqZlj95ncZILNkNMFOKwKOn2D35kCfFRQq4IvLLc9jRsq+hPwjzFzfd1tpjM3OLl5YXQQMKGg9V7SODjF3O5PStdiJcS7VVk4rPCZ1uRxMyyYOu6hUgnenXQ0cP4ANWK2wVLO1TMp/fD4UMo+5sfpOspIamp92Rur+5S0vkTA34Eb3Z+rXRj/Pgbu7ZQmj3VgKayn2IDzXgKmc95vMlHmyLkvdow7raRd/yRnZSjiCdhbE17EeuyUgsaPyXiYMlbn4DfAqg2yjnop7iU8hS2NBZY28oGf0uWNvAQ8GXQOrqUIxkN6LJYsDr7bnphLqZkl5iDgQPfnPi23n1pPH3RrVNhjx69jWyQEjeg/yM3qxl6aQIiaZF9maYV5H4uBa2TFbqnJowRM56eAd9wJMkqZRPO4RSdvvtgoEFizNfheH2CZJ0U/6V7jrCxpFhO/8C2FxbSkuY78z57EYhdKPbAohj7wSgMf+N8wH3hfcDrqxqviFkxS2kDEWNDrwh0248yrlbDmvt/jTVydvvv31qoR86n7V8K6fie7TvtxsyoWiI+sV9PMqT3oz/6LEuvcq8BVwTjrxpyPguzGSe7PyRi4z5Pu2paAyVjAvMu0pav9oPgMVh6dnAqYBbEgrjglBub1FGFW1HiYI4G/NNgkomAzKTXYaCZjcS8f9kBMhre+LEDjYLl6kB00tYtxa76b/B3ADQlx6C0yY+gvsFfqMStC2R0UvoLV2kmrEeOf1++ANeROmmbvuqqJu/dbygSdpmDlGCzTJ3mo9uPuBHdwDdv0ZP2a6t77RczynbSU1VuNgZOa7zyd779us58nWJS8WWwMlqr2Sk4FzHIJa0U4WJ5LZO0U+aQLsDPWcmCulNN81GBT8Pdlb8wvXHTXUZjKuC8W/1RNPPuyO9mOxYKcuy3YfED1U0zb5NGfGHcHfuKuq5fSiv1G+wJW6O6vWOZRskZM7NaSP2DxWs+rRsz/vvufsZ5TM6U0CdwZs77+W+no/5tn22Gp57VEyYQKVhxwctBctD4EB6nXUg5RFfd3GwMrYzGHqeNdAqbzh1DD3AurJBZ6vwitidXTiXJoPVqzye/8o0eC4LyofAP4urPE1Bs0ZiQlY+R3mKmzF8RLsmBUowyEcVj/nuE8WRMEEY7FXHzH9kiF3jSRfL8bn1cH6dXJGjFzYTVi1sGqP5dG+AHSz+sr3Hj2c9aPm5kxS+I+PThuBjvODk6xvvg/j8ICy/OyblewWJgd5ELqriXjwSZ/t2HOAnn9JjY9VvEzOQ78nyf0UAqrn7x/Bb7fQgaR//0nnfWl1COnXX8y/SYW+1RvIOKiYehlFg/QAPLbKVkT9Fh69R+wgN1yk9T/ZdyGXUo0Kh3Ja/CpmFuilIilqGHBqiuPcNdbJSWrr9QkNi4P8z5scbJ4oxg4CZhsLBl/SznN+sm0OlZYKS8+fO/iWgerBRAODH+N7wOP9lg1S79J/MSdYhuJmLAtwY70p5LHPWJ9mRH4ToPA8jh4RUP8Srr8kqbmebBu2XGPbkTVIKD55AEykzbA+ibVRniasI9bewLLEAzdRFFwz86iPxg9GsFZW81iSuJEEspwz3u/Xo0ivcmsBEyGA+MfWMxIlJhAvsvvrjkSMH6w7JkiULwivg8LTi71WBCcF2t7YHEHaWZlf1Lbn/64l3oPWV92JL1t/XCIlkavuMHJcH83n3p14/ZxCYcCvx9AxOyGudSmyJVEhNXV+TAxfrwVZmV3cKmNwLCJsLL1Wk2yevIw7xutWbukHLYlYDLs6zIF69uSFASloMvm2CYm+6EezMtgdRLqKRM6oj/+odSDgjPCitvtEFhgfKbNJ+6kdp474fZC3Esopvuw1Om004wX35PdfRjOV9TACrMYVtytV60wcbBI7wLc08BS6MflUcBe7t/0jeBDZAnLaDk2xd3rXW8Hu3s6dYTdqzjoLdbMkjzc835yyvWFVuO909YtBfFmN0AuBQ5IcSP54LsjnQmvz02i4az/8dOUUs3eQjQRc7H0ahEof8q9HwvuOysQamVnfdqvx7I8/CK+JbBESgYCmMtsIyxjY7gCHv09PxGrj5IsphVjhe0u7eGATL9If4L5/+8BFk25F/5enYnVkXmTkW0JL2Outy2x5ITwfvnxfA5Wt+v6YV6Hm8VTxl04sPru7knrixd/22JVjYerunjFPYtvYjGK4bMLjQCnYOEN/7OyScBk54d9ACuqtEbKA6i5k+81wJ3DNHn6gkEyPmVB9ObVK91i2MtpmrWgAu/zWPbHzE7UnAF8XPD6N40sT4emfCf/3H+PxXLlgR9jhduilMV4RSzd+roeHqP1IJ39y07EzJqSXu1fV7rFPR6hVvU4sF7tiiUgzJjSR8oHSm/lxk8lpaHmcAiX0GpUyjj20It+f4gpJfate7Gg8DxwsrO0zBIIeX9vxmHlFD4VHyYXEpmlfsZYPYI007x/EJdhAb1DacaMAvGyPtaluZYS/+Drg5zSYw30BhKef8HiCbZylqkPe0y8+I1/A2C1FPeLFwGnBV25S8P4qmCxRzenuAN6tcljs0y4fwZVeJPBjn7dmcuN3ZHc+8eLvn81aB/i5/QoJ2J2c+vdcLojy0ERzemw3nn1jEINSkGD2m2atA04JdgjhnPe92Gu/fNT2or4Z7cflj37vxg4CRgyyyAoYbEj96ScDP1CM7fbMJcLGtiVuzxBcJ+1qZu4o1K62/rN/LdYRP9IqZlQTylrH/Vg7x1I94H7heBGJxoIOnMP1ysOTmM0sMKsi7kJ6j2eGuszk27D6pyUUywGUSIAG9U64Q/Ad4OTepxYhytuozwpcKVXhvD+lYJnOZM7+D6BlW24DKuQ3mn7mTDwfXQi8N1bpp6iP1xguOe9v74zMHd2OfHc6u6+bBuKMQmY7ONLDggWmTglHmZh4C4soKwWiIdKBs8jCt4rdJX8AGuYN7ZBCekS1g7hyB7MPGpl0fOvao9997AvzIYpG74fB6fk6PTu58NtWH2l0gBlxkfC4cgXVDxygHYYov9+/cwJg76E6As38UMwl/5qwdyvdHFfLAUivAZ8CXPhHOosJQtglXKvcZaGwc5Jv+HPRXrpAb8H/DKlE/xwB2M/7wRolDLOvTvsf/3bJGCyj6uYABzXIIPFD96ZgQswP+za7mfVREOySmAZaGR2Kyd+Nw7eq4y5Re4Fjg8WuVKDgbMPFvsSjfCKlfRgfMAhKc/VC4X7nVjIU7E+vwCf0kSUbY4V5aqPgIOYtxCcgAWdp60tkYb6NGvx4c7KUglO+sm4kzUwq/lpWK2hasIym4UrpxLMvxqwJHARZvlcOmH9mOrG9eodxDT5Q+he7tCaZn15Hbi4gVAYbkPAySnzOsyg3dyLMgmY7rgkjnUWj7Rg3VIgNMY7a8xtbrAtFkzAsJFWM7Nb+LtlzD11uDu9XoW1OKg1MDH77rYnY4GAFbWfp5fisupY1tFXm/j68xj86cfrH7CYhlJKfaVGZdF7VYT6+b03lkXTKyn+3UxHL2OWusODg2AtZVOsYJbzR51IXCRYW+NAhISHybQ6JqXgQFkJ9gRv3VkBa174ELBTcJ2VxPt2Et/l58fMWPXq5Nz28TVnYxmn5RxZ7/y8fxgLtWh0qDrcC0JlIXVn4oAVDLveWViSQbtRMNBKwHruNQXzhT6EBe89i7l2/oNVhA0LNM2IRWvPhTWMXBpYCVgqxdxeTrnOqrumyzATZlnihV5zadbdwjwq0bTRn26exeK28nYKC5vLne5Ox/UUK8x27rDw4gho1he6pLfHOnivmJJNKKYVfT/HXBP/h2VzVQPrSnigHIel8R7g1u6rgduxfkv1NuLNQhbBAui3xZIoSgkrUZQ4UPZhhVHvH6Q13Gcb7er2hmTJhLITLmfn1NoeurU3bhAD93msMN8dEjDdmTglrEv1Zli31HUTkyYZZFsLmmmt6F4k/LqfJB7ydE0Wrmqg6BtVD+7D3FjfTInYF71hfZkXSxFP84GXMB/4lJye5v1p7ALge8CcibTYKtaheT9niSmNIAvvf4GvYGnv840QN1qn7rernDA4y63HSRERZgTNAHzNvd4HHsFc8Y870f+OewaT3Diczo3FWd04XdxZW1YHlnd/n3TdlhusyQ87sTNpEKI8rP5+QIp10t+Li+mv91TL6by/BQvHWCkhwvxYP1QCpvsBSROx7J8zsbQ9BhAyccKKEwblVppYfMJo7ajJ74altI/Fym9HIyRteqQJmCrmbpgxYX3x4uUNLDA0yqnlzVth/gOcGxS4KiWsMLtjZeLfGiHBrH4xf8WJmDuC9FuJmOaBvU87K8ihWGLD2ET14yhofOjX4FmBL7qX52PMIv5JIGCmwzKK+ho8MxoIl/BwcTpwhHvvTqwvXwvcYEnryxSs31ae54r/HqdisUKkNKbcBFh1JGScxMMsYia5RXZ3t2mE7d7rTbKIKoHQiRu8ooTPtZQSD+B9sH5yPuVE1dGJJo6CnnEdVd3C+80UH7g/4ZwDfJAzH3ijAny/xurzlBPZJDXMjbpPA1dp0deQgawKD2MtMRo1xMvL9cc5KnUB5lJaNdgcy4k1OQqCeONEnGGMZQiNc9avhbDyGLM58ZL2++XEWl5LWGImYBlJ+znxMth9uRb0cYsbWDaucUIuzy5Xf61XYa6/5LX6w80PSwMsYEUJjouaTJxyDhZgX2NlRcxs/2EgOMIMpGbPoZXmVyQmUBiA9ibWO2VVLPq9nAO3UWmAcuq9nnLfzj1p954uBnwm8bM4cEH8pgAZZ/4Q8CoWq5VW4MoHw3fa+qLRgh7ntGK5typci3UXLzfprl4e4vi/NLdXXsaTvx/PAjtjWUiXO2tKck2upWSFRglLeVi/KHmoDN0etWBj9oLmcSzQ9vNY4cZyB3PSX9dsbu5HibXEi6JTCmJ0KGP9kU5PuSf+u2xYor+3QC3hkvgk6K8R59y68ob7suH1+8Hy/jA3Jgwj4t/AfJMrYv1eXkjUgEkq9OTkSL6S2UjJCRS5SfJdLDvp+OAkW8vBc3s+GJj14DtFWDBzr6WH+u/yZMqc87zU4Zzz/+6dxBiJsSDByImB1woS+OrH9GkJ0RIHp9h3Opjj/n69HiyMcWINeTPHrpE+Z6H6SdBTJnn9r3dxLoVzuZSyPpWwzvZ5rMJdxlrAbI/FWvyE/qy3SgOrSbK6b5Rww6etx2HJi4+c6Pwa1iX77KAWSxZtDT4K9sJaMO9LwN1Y3FSpAAkbfuz+FnMjl4NDuf+7D8qjxy32AlaqekxwsyOsH8kNBajKWg7Mbl8Mrt/7+/aiP0thOIVYKC7eBW7FouLvcgtwHxavMHqAVL1G6XuloNPyBPoLXx3pBu5HiRNBHgKd38f892sH36XsntdeicwreqhR35Nuzs2ReI4nudNgJ3PO39v3MNP2qol7+yEWj/VeQdyH/jT2pjtdfj7xfT52p9iXBznH46AuxipYAGYUuFxfx1xUE3N6v7yF6BYsG3GFxPW/5ebS+126fn//XnZjbfHE8/kXcKB7TnEOs7r8uvlWsCb/FQtyLbk1eUyba3L4u5PdPbgRi+k41Fk/n0xYp+oZ7YVT3Pf6UmIvBKvm/GKBipX6+e0TYkoJy9IB0dilxuM2kKPdBPjAqZ5TCpSa6K9zH6xr5WzAc06E3ZLDgKVSEGgZsjCWBr0sFoS1EDA7Fmw2KqH8J7ln9Y47/fwLi7L/J2ZyJxH4VMvZPYiC0/R3sRih0U58HYGZeHsxKNN/p0Wx/jUru0XuAmeVKw0Qz9COpacCHIMVNBwDPIMVWbyzYGnH4eZwBFaiYCY31o9zAj3qsHZG7N7zeCxAcDos++RIZw3M81iMgizGE4Et3IHoMcxt/PcuP29/b2Zw92+8u5b7seDr5wsw3hqtyfO7NXk5zDXzWbe/hGuyFyoTnbXgFfedn3SvZxP1wEoJS2I39sIDnGCZBbO2/gKzvBat3IC/3j3dQWVOt7+dClzx//akMbltyvHZAAAAAElFTkSuQmCC", w: "data:image/png;base64,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" };
  // ---------- helpers
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function str(v) { return v == null ? "" : String(v).trim(); }
  function num(v) {
    if (v == null || v === "") return 0;
    if (typeof v === "number") return v;
    var s = String(v).replace(/[,%\s]/g, ""); var n = parseFloat(s);
    if (isNaN(n)) return 0;
    return /%/.test(String(v)) ? n / 100 : n;
  }
  function pctv(v) { var n = num(v); return n > 1 ? n / 100 : n; }
  function toDate(v) {               // → UTC midnight ms, or null
    if (v == null || v === "") return null;
    if (v instanceof Date) return Date.UTC(v.getFullYear(), v.getMonth(), v.getDate());
    if (typeof v === "number") return Math.round((v - 25569) * DAY);
    var m = String(v).trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1]);
    m = String(v).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
    return null;
  }
  function fmtD(t) {
    if (t == null) return "";
    var d = new Date(t);
    return ("0" + d.getUTCDate()).slice(-2) + "/" + ("0" + (d.getUTCMonth() + 1)).slice(-2) + "/" + d.getUTCFullYear();
  }
  function fmtP(x) { return Math.round((x || 0) * 100) + "%"; }
  function money(x) { return Math.round(x || 0).toLocaleString("en-US"); }
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // ---------- parse
  function rows(wb, XLSX, name) {
    var ws = wb.Sheets[name];
    if (!ws) throw new Error("ไม่พบชีท '" + name + "' ในไฟล์ Excel");
    var a = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
    return a.slice(1);
  }
  // v1.0 template: one "Plan" sheet (Level / ID / Parent ID) instead of Phases + Milestones + Activities
  function parsePlan(wb, XLSX, warn) {
    var phases = [], milestones = [], activities = [], byId = {}, lv = {};
    rows(wb, XLSX, "Plan").forEach(function (r, i) {
      var level = str(r[0]), id = str(r[1]), rowNo = i + 2;
      if (!id && !str(r[3])) return;
      if (!level) { warn("Plan แถว " + rowNo + ": ไม่ได้ระบุ Level (" + (id || str(r[3])) + ")"); return; }
      if (!id) { warn("Plan แถว " + rowNo + ": " + level + " ไม่มี ID"); return; }
      if (byId[id]) warn("Plan แถว " + rowNo + ": ID ซ้ำ " + id);
      byId[id] = true; lv[id] = level;
      var base = { id: id, parent: str(r[2]), name: str(r[3]), owner: str(r[7]), start: toDate(r[8]), end: toDate(r[9]),
                   remark: str(r[20]), row: rowNo, stage: str(r[24]) };
      if (level === "Phase") {
        var pp = str(r[5]) || "Phase 1";
        base.pp = pp; base.override = str(r[11]);
        base.show = str(r[6]).toUpperCase() !== "N" && pp.toUpperCase() !== "N/A";
        phases.push(base);
      } else if (level === "Milestone") {
        base.phase = base.parent; base.key = str(r[6]).toUpperCase() !== "N"; base.override = str(r[11]);
        milestones.push(base);
      } else if (level === "Activity") {
        if (!base.name) return;
        base.ms = base.parent; base.weight = num(r[10]); base.status = str(r[11]) || "Not Started";
        base.pctIn = pctv(r[12]); base.finish = toDate(r[19]); base.by = str(r[21]); base.on = toDate(r[22]); base.label = str(r[23]);
        activities.push(base);
      } else warn("Plan แถว " + rowNo + ": Level '" + level + "' ไม่รู้จัก (ใช้ Phase / Milestone / Activity)");
    });
    milestones.forEach(function (m) {
      if (lv[m.phase] !== "Phase") warn("Milestone " + m.id + ": Parent ID '" + m.phase + "' ไม่ใช่ Phase");
    });
    activities.forEach(function (a) {
      if (lv[a.ms] !== "Milestone") warn("Activity " + a.id + ": Parent ID '" + a.ms + "' ไม่ใช่ Milestone");
    });
    return { phases: phases, milestones: milestones, activities: activities };
  }

  // ---------- Kick-off pack (sheets Kickoff + Schedule) – mirrors the Excel formulas so it works before Excel recalculates
  function addMonths(t, n) {
    var d = new Date(t), y = d.getUTCFullYear(), m = d.getUTCMonth() + n, day = d.getUTCDate();
    var last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return Date.UTC(y, m, Math.min(day, last));
  }
  function wdBack(t) { var w = new Date(t).getUTCDay(); return w === 6 ? t - DAY : w === 0 ? t - 2 * DAY : t; }   // WORKDAY(x+1,-1)
  function wdFwd(t) { var w = new Date(t).getUTCDay(); return w === 6 ? t + 2 * DAY : w === 0 ? t + DAY : t; }    // WORKDAY(x-1,1)

  // ---------- sheet "Charter" (Project Charter, PMI/PMBOK) – raw values; derived defaults are filled in charterModel()
  function parseCharter(wb, XLSX) {
    if (!wb.Sheets["Charter"]) return null;
    var all = XLSX.utils.sheet_to_json(wb.Sheets["Charter"], { header: 1, raw: true, defval: null });
    var kv = {}; all.slice(1, 15).forEach(function (r) { if (r && r[0] != null) kv[str(r[0])] = r[1]; });
    var HEADS = ["Objective (SMART)", "Success Criterion", "Out of Scope", "Deliverable", "Assumption", "Constraint", "Charter Risk", "Stakeholder", "PM Authority Area", "Approver"];
    var table = function (head) {
      var i = all.findIndex(function (r) { return r && str(r[0]) === head; }); if (i < 0) return [];
      var out = [];
      for (var j = i + 1; j < all.length; j++) { var r = all[j] || []; if (HEADS.indexOf(str(r[0])) >= 0) break; if (str(r[0])) out.push(r.map(function (v) { return v; })); }
      return out;
    };
    var t = {}; HEADS.forEach(function (h0) { t[h0] = table(h0); });
    return {
      jobCode: str(kv["Job Code"]), version: str(kv["Charter Version"]) || "1.0", date: toDate(kv["Charter Date"]), status: str(kv["Charter Status"]) || "Draft",
      sponsorC: str(kv["Project Sponsor (Client)"]), sponsorH: str(kv["Project Sponsor (HUMANICA)"]), pmC: str(kv["Project Manager (Client)"]), pmH: str(kv["Project Manager (HUMANICA)"]),
      businessCase: str(kv["Business Case / Problem Statement"]), purpose: str(kv["Project Purpose / Vision"]),
      budget: num(kv["Total Budget (contract value)"]), contingency: kv["Contingency Reserve (%)"] == null ? 0.1 : pctv(kv["Contingency Reserve (%)"]),
      crLimit: kv["CR approval by PMs up to (man-days)"] == null ? 5 : num(kv["CR approval by PMs up to (man-days)"]), sla: kv["Escalation SLA (business days)"] == null ? 3 : num(kv["Escalation SLA (business days)"]),
      objectives: t["Objective (SMART)"].map(function (r) { return { text: str(r[0]), kpi: str(r[1]), target: str(r[2]), owner: str(r[3]) }; }),
      success: t["Success Criterion"].map(function (r) { return { text: str(r[0]), measure: str(r[1]), by: str(r[2]) }; }),
      outScope: t["Out of Scope"].map(function (r) { return str(r[0]); }),
      deliverables: t["Deliverable"].map(function (r) { return { text: str(r[0]), phase: str(r[1]) || "Both", by: str(r[2]), stage: str(r[3]) }; }),
      assumptions: t["Assumption"].map(function (r) { return str(r[0]); }), constraints: t["Constraint"].map(function (r) { return str(r[0]); }),
      risks: t["Charter Risk"].map(function (r) { return { text: str(r[0]), prob: str(r[1]) || "Medium", impact: str(r[2]) || "Medium", resp: str(r[3]), owner: str(r[4]) }; }),
      stakeholders: t["Stakeholder"].map(function (r) { return { name: str(r[0]), org: str(r[1]) || "Client", role: str(r[2]), infl: str(r[3]) || "Medium", int: str(r[4]) || "Medium" }; }),
      authority: t["PM Authority Area"].map(function (r) { return { area: str(r[0]), level: str(r[1]) }; }),
      approvers: t["Approver"].map(function (r) { return { name: str(r[0]), title: str(r[1]), org: str(r[2]) }; })
    };
  }
  // ---------- Change Requests: sheet "CR" (HUMANICA Change Request Form v1.4) + PM pre-check
  var CRF = {
    MODULES: ["Organization Master", "Personnel", "Payroll", "Time & Attendance", "Leave", "Benefits", "Recruitment", "PMS", "Merit", "Training", "Workflow", "User Access", "Integration"],
    // form module → keywords that match project modules in sheet Kickoff (scope check)
    KEYS: { "Organization Master": /organi[sz]ation|org\b|core/i, "Personnel": /personnel|workforce|employee|core/i, "Payroll": /payroll/i, "Time & Attendance": /time|attendance/i,
      "Leave": /leave|attendance|time/i, "Benefits": /benefit/i, "Recruitment": /recruit/i, "PMS": /perform|pms|goal/i, "Merit": /merit|perform|compens/i,
      "Training": /training|learning|lms/i, "Workflow": /workflow/i, "User Access": /security|access|user/i, "Integration": /./ },
    MS: ["Change Request Confirmation", "Requirement Confirmation", "Software Configuration", "Software Modification (design, develop, testing)", "Functional Test",
      "User Acceptance Test (HMC / Client)", "Production Deployment: 21:00 – 24:00 (System Downtime)", "System go-live / Rollout"],
    PIC: ["Client", "Client", "HMC", "HMC", "HMC", "HMC / Client", "HMC", "HMC"],
    STATUS_COL: { "Draft": "#94a3b8", "Submitted": "#e0a100", "Approved": "#2e9e6b", "In Progress": "#2f6fde", "Completed": "#1b4f8f", "Rejected": "#d64545", "Deferred": "#8c8c8c", "Cancelled": "#8c8c8c" },
    OPEN: ["Draft", "Submitted", "Approved", "In Progress"]
  };
  function parseCR(wb, XLSX) {
    if (!wb.Sheets["CR"]) return null;
    var all = XLSX.utils.sheet_to_json(wb.Sheets["CR"], { header: 1, raw: true, defval: null });
    var H = (all[0] || []).map(str), ix = function (re) { for (var i = 0; i < H.length; i++) if (re.test(H[i])) return i; return -1; };
    var col = { no: ix(/^CR No/), date: ix(/^Request Date/), name: ix(/^Name of Request/), status: ix(/^Status/), prio: ix(/^Priority/), type: ix(/^Service Type/), by: ix(/^Requested by/),
      prep: ix(/^Prepared by/), job: ix(/^Job Code/), finish: ix(/^Expected Finish/), bg: ix(/^Background/), scope: ix(/^Scope of Work/), req: ix(/^Implementation Req/), risks: ix(/^Risks/),
      mods: ix(/^Impacted Modules/), det: ix(/^Impact Details/), sa: ix(/^SA\/SE/), dev: ix(/^DEV/), qa: ix(/^QA/), imp: ix(/^IMP\/OP/), rate: ix(/^Rate/), pay: ix(/^Payment Terms/),
      asm: ix(/^Assumptions/), ref: ix(/^References/), dec: ix(/^Decision Date/), rem: ix(/^Remarks/) };
    var msCol = CRF.MS.map(function (m) { var k = m.split(" (")[0].split(":")[0]; for (var i = 0; i < H.length; i++) if (H[i].indexOf(k + " (Planned") === 0) return i; return -1; });
    var g = function (r, k) { return col[k] >= 0 ? r[col[k]] : null; };
    var lines = function (v) { return str(v).split(/\r?\n/).map(function (x) { return x.replace(/^[-•·*\d.)\s]+/, "").trim(); }).filter(Boolean); };
    return all.slice(1).filter(function (r) { return r && (str(g(r, "no")) || str(g(r, "name"))); }).map(function (r) {
      var det = {}; lines(g(r, "det")).forEach(function (l) { var m = /^([^:]+):\s*(.*)$/.exec(l); if (m) { var k = CRF.MODULES.filter(function (x) { return x.toLowerCase() === m[1].trim().toLowerCase(); })[0] || m[1].trim(); det[k] = m[2]; } });
      var modTxt = str(g(r, "mods")).toLowerCase();
      var mods = CRF.MODULES.filter(function (m) { return modTxt.indexOf(m.toLowerCase()) >= 0 || det[m] != null; });
      var md = { sa: num(g(r, "sa")), dev: num(g(r, "dev")), qa: num(g(r, "qa")), imp: num(g(r, "imp")) };
      var anyMd = ["sa", "dev", "qa", "imp"].some(function (k) { return g(r, k) != null && g(r, k) !== ""; });
      var total = md.sa + md.dev + md.qa + md.imp, rate = g(r, "rate") == null || g(r, "rate") === "" ? 15000 : num(g(r, "rate"));
      return { no: str(g(r, "no")), date: toDate(g(r, "date")), name: str(g(r, "name")), status: str(g(r, "status")) || "Draft", prio: str(g(r, "prio")) || "Normal", type: str(g(r, "type")),
        by: str(g(r, "by")), prep: str(g(r, "prep")), job: str(g(r, "job")), finish: toDate(g(r, "finish")), bg: str(g(r, "bg")), scope: str(g(r, "scope")), req: str(g(r, "req")), risks: str(g(r, "risks")),
        mods: mods, det: det, md: md, total: anyMd ? total : null, rate: rate, cost: anyMd ? total * rate : null, pay: str(g(r, "pay")),
        ms: msCol.map(function (c) { return c >= 0 ? toDate(r[c]) : null; }), asm: lines(g(r, "asm")), refs: lines(g(r, "ref")), dec: toDate(g(r, "dec")), rem: str(g(r, "rem")) };
    });
  }
  function crModel(M) {
    var list = M.crs; if (!list) return null;
    var CHm = M.charter ? charterModel(M) : null, K = M.kickoff, P = M.P;
    var limit = CHm ? CHm.crLimit : 5, golive = P.goLive != null ? P.goLive : (K ? K.golive1 : null);
    var kmods = K ? K.modules.filter(function (m) { return m.name; }).map(function (m) { return m.name + " " + (m.group || ""); }) : [];
    var crs = list.map(function (c) {
      var chk = [], add = function (lvl, t) { chk.push({ l: lvl, t: t }); };
      var level = c.total == null ? "" : c.total <= limit ? "Project Managers" : "Steering Committee";
      ["name", "bg", "scope", "type", "finish"].forEach(function (k) { if (!c[k]) add("warn", "Missing: " + { name: "Name of Request", bg: "Background", scope: "Scope of Work", type: "Service Type", finish: "Expected Finish Date" }[k]); });
      if (!c.mods.length) add("warn", "Missing: impacted modules (Part 2)");
      if (c.total == null) add("warn", "Missing: effort estimate (man-days)");
      else add("ok", "Effort " + c.total + " MD · " + Math.round(c.cost).toLocaleString("en-US") + " " + (P.currency || "THB") + " → approval by " + level + " (limit " + limit + " MD, sheet Charter)");
      if (kmods.length) {
        var out = c.mods.filter(function (m) { return m !== "Integration" && !kmods.some(function (k) { return CRF.KEYS[m].test(k); }); });
        if (out.length) add("warn", "Not in contracted modules (sheet Kickoff): " + out.join(", ") + " → new scope, normally Chargeable");
        else if (c.mods.length) add("ok", "Impacted modules are within the contracted scope");
      }
      if (c.mods.indexOf("Integration") >= 0 && K) { var known = K.integrations.filter(function (x) { return x.system; }).map(function (x) { return x.system.toLowerCase(); });
        if (!known.some(function (s0) { return (c.name + " " + c.scope).toLowerCase().indexOf(s0.split(/[ –-]/)[0]) >= 0; })) add("info", "Integration impact – check the interface against the integration list in sheet Kickoff"); }
      if (c.type === "Non-chargeable" && c.total != null && c.total > limit) add("warn", "Non-chargeable but above the PM limit – confirm with the account manager");
      if (c.type === "Chargeable" && !c.pay) add("warn", "Chargeable CR without Payment Terms");
      var ds = c.ms.filter(function (d) { return d != null; });
      if (ds.some(function (d, i) { return i && d < ds[i - 1]; })) add("warn", "Planned finish dates are not in sequence (Part 3)");
      if (c.finish != null && ds.length && ds[ds.length - 1] > c.finish) add("warn", "Last milestone is after the Expected Finish Date");
      if (golive != null && c.finish != null) {
        if (c.finish > golive) add("warn", "Finishes after go-live (" + fmtD(golive) + ") – deliver in hypercare or a later release");
        else if (c.finish >= golive - 30 * DAY) add("warn", "Lands in the 30-day go-live freeze window – Steering to confirm");
      }
      if (/approved|rejected|deferred/i.test(c.status) && c.dec == null) add("info", "Decision Date is empty");
      return Object.assign({}, c, { level: level, check: chk, warnN: chk.filter(function (x) { return x.l === "warn"; }).length });
    });
    var sum = function (arr, k) { return arr.reduce(function (a, c) { return a + (c[k] || 0); }, 0); };
    var appr = crs.filter(function (c) { return /approved|in progress|completed/i.test(c.status); });
    return { crs: crs, limit: limit, golive: golive, currency: P.currency || "THB",
      kpi: { total: crs.length, pending: crs.filter(function (c) { return c.status === "Submitted"; }).length, draft: crs.filter(function (c) { return c.status === "Draft"; }).length,
        apprN: appr.length, apprMd: sum(appr, "total"), apprCost: sum(appr, "cost"), chargeCost: sum(appr.filter(function (c) { return c.type === "Chargeable"; }), "cost"),
        pendMd: sum(crs.filter(function (c) { return c.status === "Submitted"; }), "total"), steer: crs.filter(function (c) { return c.status === "Submitted" && c.level === "Steering Committee"; }).length } };
  }

  // ---------- project documents: sheets Meetings / Sign-off / BB / Training (+ RAIDD columns on Issues)
  function parseDocs(wb, XLSX) {
    var sheet = function (name) {
      if (!wb.Sheets[name]) return null;
      var all = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null }), H = (all[0] || []).map(str);
      var ix = function (re) { for (var i = 0; i < H.length; i++) if (re.test(H[i])) return i; return -1; };
      return { rows: all.slice(1).filter(function (r) { return r && r.some(function (v) { return v != null && v !== ""; }); }), ix: ix };
    };
    var L = function (v) { return str(v).split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean); };
    var out = {};
    var m = sheet("Meetings");
    out.meetings = m ? m.rows.filter(function (r) { return str(r[m.ix(/^Meeting ID/)]); }).map(function (r) { var g = function (re) { return r[m.ix(re)]; };
      return { id: str(g(/^Meeting ID/)), type: str(g(/^Type/)) || "External", date: toDate(g(/^Date/)), time: str(g(/^Time/)), loc: str(g(/^Location/)), name: str(g(/^Meeting \/ Project/)),
        stage: str(g(/^Stage/)), prep: str(g(/^Prepared/)), pc: L(g(/^Participants – Client/)), ph: L(g(/^Participants – HUMANICA/)), agenda: L(g(/^Agenda/)),
        minutes: L(g(/^Minutes/)).map(function (x) { var k = /^([^:]{2,60}):\s*(.+)$/.exec(x); return k ? { topic: k[1].trim(), text: k[2] } : { topic: "", text: x }; }),
        next: toDate(g(/^Next Meeting/)), status: str(g(/^Status/)) || "Draft", link: str(g(/^Recording/)), rem: str(g(/^Remarks/)) }; }) : null;
    var s = sheet("Sign-off");
    out.signoffs = s ? s.rows.filter(function (r) { return str(r[s.ix(/^Deliverable$/)]); }).map(function (r) { var g = function (re) { return r[s.ix(re)]; };
      var ppl = function (v) { return L(v).map(function (x) { var p = x.split("|").map(function (y) { return y.trim(); }); return { name: p[0] || "", title: p[1] || "", period: p[2] || "" }; }); };
      return { no: str(g(/^Sign-off No/)), name: str(g(/^Deliverable$/)), phase: str(g(/^Phase Name/)), app: str(g(/^Application/)), module: str(g(/^Module/)), place: str(g(/^Place/)),
        stage: str(g(/^Schedule Stage/)), start: toDate(g(/^Start Date/)), end: toDate(g(/^Completion Date/)), desc: str(g(/^Brief Description/)), items: L(g(/^Deliverables \(/)),
        pc: ppl(g(/^Client Participants/)), ph: ppl(g(/^HUMANICA Participants/)), status: str(g(/^Status/)) || "Pending", signed: toDate(g(/^Signed Date/)), rem: str(g(/^Remarks/)) }; }) : null;
    var b = sheet("BB");
    out.bb = b ? b.rows.filter(function (r) { return str(r[b.ix(/^Module/)]); }).map(function (r) { var g = function (re) { return r[b.ix(re)]; };
      return { module: str(g(/^Module/)), doc: str(g(/^BB Document/)), phase: str(g(/^Phase/)) || "Phase 1", ver: str(g(/^Version/)), status: str(g(/^Status/)) || "Draft", co: str(g(/^Client Owner/)),
        hc: str(g(/^HUMANICA Consultant/)), target: toDate(g(/^Target/)), signed: toDate(g(/^Signed Date/)), rem: str(g(/^Remarks/)),
        apx: b.ix(/^Appendix Complete/) >= 0 && g(/^Appendix Complete/) != null && g(/^Appendix Complete/) !== "" ? num(g(/^Appendix Complete/)) : null, apxI: str(g(/^Appendix Issues/)), apxD: toDate(g(/^Appendix Checked/)),
        rev: L(g(/^Revision History/)).map(function (x) { var p = x.split("|").map(function (y) { return y.trim(); }); return { v: p[0] || "", d: p[1] || "", by: p[2] || "", note: p[3] || "" }; }) }; }) : null;
    var t = sheet("Training");
    out.training = t ? t.rows.filter(function (r) { return str(r[t.ix(/^Subject/)]); }).map(function (r) { var g = function (re) { return r[t.ix(re)]; };
      return { no: str(g(/^Session No/)), subject: str(g(/^Subject/)), date: toDate(g(/^Date/)), time: str(g(/^Time/)), place: str(g(/^Place/)), by: str(g(/^Conducted/)), stage: str(g(/^Stage/)), att: L(g(/^Attendees/)), rem: str(g(/^Remarks/)) }; }) : null;
    return out;
  }
  var RAIDD_OF = { "Risk": "Risk", "Issue": "Issue", "Action": "Action", "Coordination": "Action", "Dependency": "Dependency", "Decision": "Decision", "Decision Needed": "Decision" };
  function docsModel(M) {
    var D = M.docs || {}, K = M.kickoff, CH = M.charter ? charterModel(M) : null, CRm = M.crs ? crModel(M) : null, rd = M.rd;
    var stage = {}; if (K) K.stages.forEach(function (s0) { stage[s0.id] = s0; });
    var signoffs = (D.signoffs || []).map(function (s0) {
      var st = stage[s0.stage], key = /2/.test(s0.phase) ? "p2" : "p1";
      return Object.assign({}, s0, { start: s0.start != null ? s0.start : st && st[key] ? st[key][0] : null, end: s0.end != null ? s0.end : st && st[key] ? st[key][1] : null });
    });
    var issues = M.issues.map(function (i) { return Object.assign({ raidd: RAIDD_OF[i.type] || i.type }, i); });
    var meetings = (D.meetings || []).map(function (m) {   // RAIDD of a meeting = items raised there (Source) + items reviewed there (Remarks line "RAIDD: I01, I02")
      var rv = /RAIDD:\s*([^\n]+)/.exec(m.rem || ""), ids = rv ? rv[1].split(/[,\s]+/).filter(Boolean) : [];
      return Object.assign({}, m, { reviewed: ids, raidd: issues.filter(function (i) { return (i.src && i.src === m.id) || ids.indexOf(i.id) >= 0; }) }); });
    // next-meeting agenda: open decisions, overdue / due-soon actions, key milestones in the next 14 days
    var openI = issues.filter(function (i) { return i.open; });
    var agenda = {
      decisions: openI.filter(function (i) { return i.raidd === "Decision" || i.steer === "Decision"; }),
      overdue: openI.filter(function (i) { return i.due != null && i.due < rd; }),
      soon: openI.filter(function (i) { return i.due != null && i.due >= rd && i.due <= rd + 14 * DAY && !(i.raidd === "Decision" || i.steer === "Decision"); }),
      ms: M.milestones.filter(function (m) { return m.key && m.status !== "Completed" && m.end != null && m.end >= rd && m.end <= rd + 14 * DAY; }),
      last: meetings.slice().sort(function (a, b) { return (b.date || 0) - (a.date || 0); })[0] || null
    };
    var bb = D.bb || [], tr = D.training || [];
    var cnt = function (arr, f) { return arr.filter(f).length; };
    var docs = [
      ["Project Agenda", "auto", (agenda.decisions.length + agenda.overdue.length + agenda.soon.length) + " items for the next meeting", "html"],
      ["Minutes of Meeting", meetings.length ? "ok" : "none", meetings.length + " meetings · " + cnt(meetings, function (m) { return m.status !== "Draft"; }) + " final", "word"],
      ["Project Issue", openI.length ? "ok" : "none", openI.length + " open RAIDD items", "html"],
      ["Project Issue Log", "ok", issues.length + " RAIDD items · " + cnt(issues, function (i) { return i.escalate; }) + " escalated", "html"],
      ["Project Change Request", CRm && CRm.crs.length ? "ok" : "none", CRm ? CRm.crs.length + " CRs · " + CRm.kpi.pending + " pending" : "–", "word"],
      ["Project Deliverable Sign-off", signoffs.length ? "ok" : "none", cnt(signoffs, function (s0) { return /signed/i.test(s0.status); }) + " of " + signoffs.length + " signed", "word"],
      ["Project Status Report", "ok", "External · Internal · Steering", "ppt"],
      ["Training Attendees", tr.length ? "ok" : "none", tr.length + " sessions", "word"],
      ["Customer Service Sheet", "na", "Operations form – outside this kit", ""]
    ];
    return { issues: issues, meetings: meetings, signoffs: signoffs, bb: bb, training: tr, agenda: agenda, docs: docs, charter: CH, jobCode: CH ? CH.jobCode : "" };
  }

  function parseKickoff(wb, XLSX) {
    if (!wb.Sheets["Kickoff"] || !wb.Sheets["Schedule"]) return null;
    var all = XLSX.utils.sheet_to_json(wb.Sheets["Kickoff"], { header: 1, raw: true, defval: null });
    var kv = {}; all.slice(1, 13).forEach(function (r) { if (r && r[0] != null) kv[str(r[0])] = r[1]; });
    var table = function (head, n) {
      var i = all.findIndex(function (r) { return r && str(r[0]) === head; }); if (i < 0) return [];
      return all.slice(i + 1, i + 1 + n).filter(function (r) { return r && (str(r[0]) || str(r[2])); });
    };
    var K = {
      kickoff: toDate(kv["Kick-off Meeting Date"]), golive1: toDate(kv["Phase 1 Go-live Date"]), months1: num(kv["Phase 1 Duration (months)"]),
      golive2: toDate(kv["Phase 2 Go-live Date"]), months2: num(kv["Phase 2 Duration (months)"]), hyper: kv["Hypercare (months)"] == null ? 1 : num(kv["Hypercare (months)"]),
      weekly: str(kv["Weekly Project Meeting"]), steering: str(kv["Steering Committee Meeting"]), change: str(kv["Show Change Management stream"]).toUpperCase() !== "N",
      modules: table("Module", 20).map(function (r) { return { name: str(r[0]), group: str(r[1]), phase: str(r[2]) || "Phase 1", features: str(r[3]) }; }),
      integrations: table("Integration / System", 20).map(function (r) { return { system: str(r[0]), dir: str(r[1]) || "Outbound", phase: str(r[2]) || "Phase 1", data: str(r[3]) }; }),
      team: table("Team / Role", 40).map(function (r) { return { role: str(r[0]), side: str(r[1]) || "Client", name: str(r[2]), pos: str(r[3]) }; })
    };
    K.start1 = K.golive1 != null && K.months1 ? addMonths(K.golive1, -K.months1) : null;
    K.start2 = K.golive2 != null && K.months2 ? addMonths(K.golive2, -K.months2) : null;
    if (K.kickoff == null) K.kickoff = K.start1;
    var pdate = function (pct, isEnd, st, gl) {
      if (st == null || gl == null) return null;
      if (isEnd && String(pct).toUpperCase() === "H") return wdBack(addMonths(gl, K.hyper));
      var p = pctv(pct), base = st + Math.round(p * (gl - st) / DAY) * DAY;
      if (p >= 1) return gl;
      if (isEnd) return wdBack(base);
      return p <= 0 ? st : wdFwd(base);
    };
    K.stages = rows(wb, XLSX, "Schedule").filter(function (r) { return str(r[0]); }).map(function (r) {
      var s = { id: str(r[0]), stream: str(r[1]) || "Implementation", name: str(r[2]), th: str(r[3]), applies: str(r[4]) || "Both", sp: r[5], ep: r[6] };
      s.p1 = s.applies === "Phase 2" ? null : [pdate(s.sp, false, K.start1, K.golive1), pdate(s.ep, true, K.start1, K.golive1)];
      s.p2 = s.applies === "Phase 1" ? null : [pdate(s.sp, false, K.start2, K.golive2), pdate(s.ep, true, K.start2, K.golive2)];
      if (s.p1 && s.p1[0] == null) s.p1 = null; if (s.p2 && s.p2[0] == null) s.p2 = null;
      return s;
    });
    return K;
  }
  // fill Plan Start/End that are formulas without a cached value (file never opened in Excel)
  function applySchedule(pl, K) {
    if (!K) return;
    var st = {}; K.stages.forEach(function (s) { st[s.id] = s; });
    var byId = {}; pl.phases.concat(pl.milestones).forEach(function (x) { byId[x.id] = x; });
    var ppOf = function (x) { var p = x.pp ? x : byId[x.phase]; return p ? p.pp : "Phase 1"; };
    var fill = function (x, stage, pp) {
      var s = st[stage]; if (!s) return;
      var d = pp === "Phase 2" ? s.p2 : s.p1; if (!d) return;
      if (x.start == null) x.start = d[0];
      if (x.end == null) x.end = d[1];
    };
    pl.phases.forEach(function (p) { if (p.stage) fill(p, p.stage, p.pp); });
    pl.milestones.forEach(function (m) { if (m.stage) fill(m, m.stage, ppOf(m)); });
    pl.activities.forEach(function (a) { var m = byId[a.ms]; var stg = a.stage || (m && m.stage); if (m && stg) fill(a, stg, ppOf(m)); });
  }
  function parseWorkbook(wb, XLSX) {
    var kv = {}, warnings = [];
    var warn = function (t) { if (warnings.indexOf(t) < 0) warnings.push(t); };
    rows(wb, XLSX, "Project").forEach(function (r) { if (r[0] != null) kv[str(r[0])] = r[1]; });
    kv.__header = null;
    if (wb.Sheets["Plan"]) {
      var pl = parsePlan(wb, XLSX, warn), K = parseKickoff(wb, XLSX), CHR = parseCharter(wb, XLSX), CRS = parseCR(wb, XLSX), DOCS = parseDocs(wb, XLSX);
      applySchedule(pl, K);
      return Object.assign(pl, parseRest(wb, XLSX), { kv: kv, warnings: warnings, format: "plan", kickoff: K, charter: CHR, crs: CRS, docs: DOCS });
    }
    var phases = rows(wb, XLSX, "Phases").filter(function (r) { return str(r[0]); }).map(function (r) {
      return { id: str(r[0]), name: str(r[1]), pp: str(r[2]) || "Phase 1", start: toDate(r[3]), end: toDate(r[4]),
               owner: str(r[5]), override: str(r[9]), show: str(r[11]).toUpperCase() !== "N", remark: str(r[12]) };
    });
    var milestones = rows(wb, XLSX, "Milestones").filter(function (r) { return str(r[0]); }).map(function (r) {
      return { id: str(r[0]), name: str(r[1]), phase: str(r[2]), key: str(r[4]).toUpperCase() !== "N",
               start: toDate(r[5]), end: toDate(r[6]), owner: str(r[7]), override: str(r[13]), remark: str(r[15]) };
    });
    var activities = rows(wb, XLSX, "Activities").filter(function (r) { return str(r[1]) && str(r[5]); }).map(function (r) {
      return { id: str(r[0]), ms: str(r[1]), name: str(r[5]), owner: str(r[6]), start: toDate(r[7]), end: toDate(r[8]),
               weight: num(r[9]), status: str(r[10]) || "Not Started", pctIn: pctv(r[11]), finish: toDate(r[14]),
               remark: str(r[15]), by: str(r[16]), on: toDate(r[17]) };
    });
    return Object.assign({ kv: kv, phases: phases, milestones: milestones, activities: activities, warnings: warnings, format: "legacy" },
      parseRest(wb, XLSX));
  }
  function parseRest(wb, XLSX) {
    var highlights = rows(wb, XLSX, "Highlights").filter(function (r) { return str(r[2]); }).map(function (r) {
      return { date: toDate(r[0]), type: str(r[1]), text: str(r[2]), vis: str(r[3]) || "All", order: num(r[4]) };
    });
    var issues = rows(wb, XLSX, "Issues").filter(function (r) { return str(r[2]); }).map(function (r) {
      return { id: str(r[0]), type: str(r[1]), text: str(r[2]), impact: str(r[3]), action: str(r[4]), due: toDate(r[5]),
               owner: str(r[6]), rag: str(r[7]) || "On Track", open: str(r[8]).toLowerCase() !== "closed", vis: str(r[9]) || "All",
               steer: str(r[10]), ask: str(r[11]), focus: str(r[12]), prio: str(r[13]), raisedBy: str(r[14]), raised: toDate(r[15]), closed: toDate(r[16]),
               escalate: /^y/i.test(str(r[17])), src: str(r[18]) };
    });
    var billing = wb.Sheets["Billing"] ? rows(wb, XLSX, "Billing").filter(function (r) { return str(r[1]); }).map(function (r) {
      return { no: r[0], fee: str(r[1]), inst: r[2], pct: pctv(r[3]), ms: str(r[6]), cond: str(r[7]), invNo: str(r[11]),
               invDate: toDate(r[12]), paidDate: toDate(r[14]), paidAmt: num(r[15]), remark: str(r[17]) };
    }) : [];
    return { highlights: highlights, issues: issues, billing: billing };
  }

  // ---------- compute (mirrors the Excel formulas)
  function planned(rd, s, e) {
    if (s == null || e == null) return 0;
    if (rd < s) return 0;
    if (rd >= e) return 1;
    return ((rd - s) / DAY + 1) / ((e - s) / DAY + 1);
  }
  function autoStatus(pct, pl, rd, s, e, tol) {
    if (Math.round(pct * 1e4) >= 1e4) return "Completed";
    if (pct === 0 && (s == null || rd < s)) return "Not Started";   // = Plan!R
    if (e != null && rd > e) return "Delayed";
    if (pl - pct > tol) return "At Risk";
    if (pct === 0) return "Not Started";
    return "On Track";
  }
  function compute(raw) {
    var kv = raw.kv;
    var rd = toDate(kv["Report Date"]) || Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
    var tol = kv["At-Risk Tolerance"] == null ? 0.15 : pctv(kv["At-Risk Tolerance"]);
    var scope = str(kv["Report Scope"]) || "All";
    var P = {
      client: str(kv["Client Name"]), short: str(kv["Client Short Name"]) || "Project", vendor: str(kv["Company Name"]) || str(kv["Vendor Name"]),
      name: str(kv["Project Name"]), title: str(kv["Report Title"]) || "Project Status Update", rd: rd,
      lead: str(kv["Project Lead"]), model: str(kv["Project Model"]), phase: str(kv["Current Project Phase"]),
      scope: scope, goLive: toDate(kv["Go-Live Date"]), rationale: str(kv["Assessment Rationale"]),
      override: str(kv["Overall Status Override"]), logo: str(kv["Client Logo URL"]), tol: tol, currency: str(kv["Currency"]) || "THB",
      credit: num(kv["Credit Term (days)"]) || 30, kv: kv
    };
    var phById = {}, msById = {};
    raw.phases.forEach(function (p) { phById[p.id] = p; p.w = 0; p.sum = 0; });
    raw.milestones.forEach(function (m) { msById[m.id] = m; m.w = 0; m.sum = 0; m.n = 0; m.acts = [];
      m.pp = phById[m.phase] ? phById[m.phase].pp : ""; });
    raw.activities.forEach(function (a) {
      a.eff = a.status === "Done" ? 1 : (a.status === "Not Started" || a.status === "N/A" || !a.status) ? 0 : Math.min(1, a.pctIn);
      a.ew = a.status === "N/A" ? 0 : a.weight;
      var m = msById[a.ms];
      a.msName = m ? m.name : "⚠ " + a.ms;
      if (!m) return;
      m.n++; m.w += a.ew; m.sum += a.ew * a.eff; m.acts.push(a);
      var p = phById[m.phase]; if (p) { p.w += a.ew; p.sum += a.ew * a.eff; }
    });
    function finish(x) {
      x.pct = x.w ? x.sum / x.w : 0;
      x.planned = planned(rd, x.start, x.end);
      x.auto = autoStatus(x.pct, x.planned, rd, x.start, x.end, tol);
      x.status = STATUS.indexOf(x.override) >= 0 ? x.override : x.auto;
    }
    raw.phases.forEach(finish);
    raw.milestones.forEach(finish);
    // Phase rows without Start/End (Plan sheet) → draw the Timeline bar over the span of its milestones
    raw.phases.forEach(function (p) {
      var kids = raw.milestones.filter(function (m) { return m.phase === p.id; });
      var s = kids.map(function (m) { return m.start; }).filter(function (t) { return t != null; });
      var e = kids.map(function (m) { return m.end; }).filter(function (t) { return t != null; });
      if (p.start == null && s.length) { p.start = Math.min.apply(null, s); p.derived = true; }
      if (p.end == null && e.length) { p.end = Math.max.apply(null, e); p.derived = true; }
    });
    function inScope(pp) { return String(pp).toUpperCase() !== "N/A" && (scope === "All" || pp === scope); }
    var W = 0, S = 0, PL = 0;
    raw.milestones.forEach(function (m) { if (!inScope(m.pp)) return; W += m.w; S += m.pct * m.w; PL += m.planned * m.w; });
    var ov = W ? S / W : 0, ovPl = W ? PL / W : 0;
    var ovAuto = Math.round(ov * 1e4) >= 1e4 ? "Completed" : ovPl - ov > 2 * tol ? "Delayed" : ovPl - ov > tol ? "At Risk" : ov === 0 ? "Not Started" : "On Track";
    P.overall = ov; P.overallPlanned = ovPl; P.overallAuto = ovAuto;
    P.overallStatus = STATUS.indexOf(P.override) >= 0 ? P.override : ovAuto;

    // billing
    var fees = {};
    raw.billing.forEach(function (b) {
      b.base = num(kv[b.fee]); b.amount = b.pct * b.base;
      var m = msById[b.ms];
      b.msName = m ? m.name : (b.ms ? "⚠ " + b.ms : ""); b.msPct = m ? m.pct : 0; b.msEnd = m ? m.end : null;
      b.msStatus = m ? m.status : "";
      b.due = b.invDate != null ? b.invDate + P.credit * DAY : null;
      b.status = b.paidDate != null ? "Paid" : b.invDate != null ? (rd > b.due ? "Overdue" : "Invoiced")
        : Math.round(b.msPct * 1e4) >= 1e4 ? "Ready to Invoice" : (b.msEnd != null && rd > b.msEnd) ? "Milestone Delayed" : "Pending Milestone";
      fees[b.fee] = b.base;
    });

    var hl = raw.highlights.filter(function (h) { return h.date == null || h.date === rd; })
      .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });

    return {
      P: P, rd: rd, warnings: raw.warnings || [], format: raw.format, kickoff: raw.kickoff || null, charter: raw.charter || null, crs: raw.crs || null, docs: raw.docs || null,
      phases: raw.phases.filter(function (p) { return p.show && inScope(p.pp); }),
      allPhases: raw.phases,
      milestones: raw.milestones.filter(function (m) { return inScope(m.pp); }),
      activities: raw.activities, highlights: hl, issues: raw.issues, billing: raw.billing, fees: fees
    };
  }

  // ---------- render
  function dot(s, cls) { return '<span class="dot ' + (cls || SCLASS[s] || "s-ns") + '" title="' + esc(s) + '"></span>'; }
  function chip(s, map) { return '<span class="chip ' + ((map || SCLASS)[s] || "s-ns") + '">' + esc(s) + "</span>"; }
  function bar(p, s) {
    return '<div class="mbar"><div class="mfill ' + (SCLASS[s] || "s-ns") + '" style="width:' + Math.round(p * 100) + '%"></div></div>';
  }
  function short(t) { return fmtD(t); }  // app standard: dd/mm/yyyy everywhere
  function dm(t) { var d = new Date(t); return ("0" + d.getUTCDate()).slice(-2) + "/" + ("0" + (d.getUTCMonth() + 1)).slice(-2); }
  // "+ N more" → click to show / hide the extra rows (rows beyond the limit are rendered with class "xtra", hidden until the card has class "xp")
  function more(n) {
    if (n <= 0) return "";
    var t = LANG === "th" ? "+ อีก " + n + " รายการ" : "+ " + n + " more", less = LANG === "th" ? "− ย่อ" : "− show less";
    return '<div class="more" role="button" tabindex="0" onclick="var c=this.closest(\'.card\');c.classList.toggle(\'xp\');this.textContent=c.classList.contains(\'xp\')?\'' + less + '\':\'' + t + '\'">' + t + "</div>";
  }
  function xtra(html, i, lim) { return i < lim ? html : html.replace(/^<(li|tr)/, '<$1 class="xtra"').replace('<li class="xtra" class="', '<li class="xtra '); }

  // Page header (same as the slides): title + "Client | Update · date" on the left;
  // client logo · HUMANICA logo on the right with the Project Manager under them.
  function logos(P) {
    var vendor = /humanica/i.test(P.vendor || "HUMANICA") ? '<img class="hlogo r" src="' + BRAND.hw + '" alt="HUMANICA">' : '<div class="vendor">' + esc(P.vendor) + "</div>";
    return '<div class="rh-logos">' + (P.logo ? '<span class="clogo-box"><img src="' + esc(P.logo) + '" alt="' + esc(P.client) + '"></span>' : "") + vendor + "</div>";
  }
  function header(M, mode, pageTitle) {
    var P = Object.assign({}, M.P), ph = M.P.placeholder;
    if (ph) { P.name = P.name || "Project Name"; P.client = P.client || "Client Name"; P.lead = P.lead || "Project Manager"; }
    return '<header class="rh"><div class="rh-l"><div class="rh-tt"><h1>' + esc(pageTitle) + '</h1>' +
      '<div class="sub">' + esc(P.client || P.name) + " &nbsp;|&nbsp; Update · <b>" + fmtD(P.rd) + "</b></div></div></div>" +
      '<div class="rh-rr">' + logos(P) + '<div class="rh-pm">' + (mode === "internal" ? '<span class="badge b-int">INTERNAL · CONFIDENTIAL</span> ' : "") +
      "Project Manager: <b>" + esc(P.lead || "–") + "</b></div></div></header>";
  }
  // Cover page (same as the first slide)
  function pageCover(M, mode) {
    var P = M.P;
    return '<section class="page cover">' +
      '<div class="cv-top">' + (mode === "internal" ? '<span class="badge b-int">INTERNAL · CONFIDENTIAL</span>' : "<span></span>") + logos(P) + "</div>" +
      '<div class="cv-mid"><h1>Project Progress Status</h1><div class="cv-client">' + esc(P.client || P.name) + '</div><div class="cv-date">Update · ' + fmtD(P.rd) + "</div></div>" +
      '<div class="cv-bot"><div><div class="cv-k">OVERALL STATUS</div><div class="cv-row"><span class="cv-st ' + (SCLASS[P.overallStatus] || "s-ns") + '">' + esc(P.overallStatus) + "</span>" +
      '<span class="cv-prog">Progress <b>' + fmtP(P.overall) + "</b> &nbsp;·&nbsp; Plan " + fmtP(P.overallPlanned) + "</span></div></div>" +
      '<div class="cv-pm">Project Manager : <b>' + esc(P.lead || "–") + "</b></div></div></section>";
  }
  function footer(M, mode, n) {
    return '<footer class="rf"><div class="leg">' + STATUS.map(function (s) { return dot(s) + s; }).join("") +
      '<span class="imp">Impact: S Scope · T Time · C Cost · Q Quality</span></div><div class="pg">' + esc(M.P.vendor) + " · " +
      (mode === "internal" ? "Internal use only" : esc(M.P.short)) + " · " + n + "</div></footer>";
  }
  function title(t, cls) { return '<div class="st ' + (cls || "") + '">' + t + "</div>"; }

  function pageSummary(M, mode, n) {
    var P = M.P;
    var vis = function (x) { return mode === "internal" || x.vis !== "Internal"; };
    var tagInt = function (x) { return x.vis === "Internal" ? ' <em class="int">internal</em>' : ""; };
    var acc = M.highlights.filter(function (h) { return h.type === "Accomplishment" && vis(h); });
    var up = M.highlights.filter(function (h) { return h.type === "Upcoming" && vis(h); });
    var rank = { "Delayed": 0, "At Risk": 1, "On Track": 2, "Not Started": 3, "Completed": 4 };
    var iss = M.issues.filter(function (i) { return i.open && vis(i); })
      .sort(function (a, b) { return (rank[a.rag] - rank[b.rag]) || ((a.due == null ? 9e15 : a.due) - (b.due == null ? 9e15 : b.due)); });
    var days = P.goLive != null ? Math.round((P.goLive - P.rd) / DAY) : null;
    var keyMs = M.milestones.filter(function (m) { return m.key; });
    var attn = keyMs.filter(function (m) { return m.status === "Delayed" || m.status === "At Risk"; })
      .sort(function (a, b) { return (rank[a.status] - rank[b.status]) || (a.end - b.end); });
    var gap = P.overallPlanned - P.overall;
    var cnt = {}; STATUS.forEach(function (s) { cnt[s] = 0; }); keyMs.forEach(function (m) { cnt[m.status]++; });
    var LIM = 4;

    var h = '<section class="page">' + header(M, mode, "Project Status Summary");
    // hero tiles
    h += '<div class="hero">' +
      '<div class="tile t-status ' + SCLASS[P.overallStatus] + '"><div class="tl-k">Overall status</div><div class="big">' + esc(P.overallStatus) + "</div>" +
      '<div class="tl-s">' + (gap > 0.005 ? "Behind plan by " + Math.round(gap * 100) + " pts" : "On or ahead of plan") +
      (P.override && mode === "internal" ? " · auto: " + esc(P.overallAuto) : "") + "</div></div>" +
      '<div class="tile t-prog"><div class="tl-k">Overall progress</div><div class="big">' + fmtP(P.overall) + '</div><div class="pbar"><div class="pfill" style="width:' +
      fmtP(P.overall) + '"></div><div class="pmark" style="left:' + fmtP(P.overallPlanned) + '"></div></div><div class="tl-s">Plan ' + fmtP(P.overallPlanned) + " at " + short(P.rd) + "</div></div>" +
      '<div class="tile t-live"><div class="tl-k">Go-live</div><div class="big">' + (days == null ? "–" : days >= 0 ? days + '<small> days</small>' : "Live") +
      '</div><div class="tl-s">' + fmtD(P.goLive) + "</div></div>" +
      '<div class="tile"><div class="tl-k">Key milestones (' + keyMs.length + ')</div><div class="hbar">' +
      STATUS.map(function (s) { return cnt[s] ? '<span class="' + SCLASS[s] + '" style="flex:' + cnt[s] + '"></span>' : ""; }).join("") +
      '</div><div class="hleg">' + STATUS.map(function (s) { return cnt[s] ? "<span>" + dot(s) + "<b>" + cnt[s] + "</b> " + s + "</span>" : ""; }).join("") + "</div></div></div>";
    // rationale
    if (P.rationale) h += '<div class="rat" title="คลิกเพื่อดูข้อความทั้งหมด" onclick="this.classList.toggle(\'xp\')"><div class="clamp">' + esc(P.rationale) + "</div></div>";
    else if (P.placeholder) h += '<div class="rat ph"><div class="clamp">Assessment Rationale – สรุปภาพรวมโครงการและเหตุผลของสถานะ 2–3 บรรทัด (ชีท Project)</div></div>';
    // three columns
    var list = function (arr) {
      return '<ul class="ll">' + (arr.map(function (x, i) { return xtra("<li>" + esc(x.text) + tagInt(x) + "</li>", i, LIM); }).join("") ||
        '<li class="muted">–</li>') + "</ul>" + more(arr.length - LIM);
    };
    h += '<div class="cols3"><div class="card">' + title("Key accomplishments", "c-done") + list(acc) + "</div>" +
      '<div class="card">' + title("Next steps", "c-ok") + list(up) + "</div>" +
      '<div class="card">' + title("Milestones needing attention", "c-late") + '<ul class="att">' +
      (attn.map(function (m, i) {
        return (i < LIM ? "<li>" : '<li class="xtra">') + dot(m.status) + '<div><div class="an">' + esc(m.name) + '</div><div class="as">' + fmtP(m.pct) + " · target " + short(m.end) +
          (m.status === "Delayed" ? ' · <b class="s-latet">overdue</b>' : "") + "</div></div></li>";
      }).join("") || '<li class="muted">All key milestones on track</li>') + "</ul>" + more(attn.length - LIM) + "</div></div>";
    // issues
    h += '<div class="card">' + title("Top issues, risks &amp; decisions" + (iss.length ? ' <span class="cnt">' + iss.length + " open</span>" : "")) +
      '<table class="iss"><tbody>' +
      (iss.map(function (i, k) {
        return (k < 3 ? "<tr>" : '<tr class="xtra">') + '<td class="w-dot">' + dot(i.rag) + '</td><td class="w-topic"><div class="clamp"><span class="tag">' + esc(i.type) + "</span>" + esc(i.text) + tagInt(i) +
          '</div></td><td class="w-imp">' + (i.impact ? '<span class="imp-t">' + esc(i.impact) + "</span>" : "") + '</td><td class="w-act"><div class="clamp">' + esc(i.action) + "</div>" +
          '</td><td class="w-own"><b>' + esc(i.owner) + "</b><br>" + fmtD(i.due) + "</td></tr>";
      }).join("") || '<tr><td class="muted">No open items</td></tr>') + "</tbody></table>" + more(iss.length - 3) + "</div>";
    return h + footer(M, mode, n) + "</section>";
  }


  // ---------- Items for Steering (Issues!K Decision / Acknowledge)
  function steerItems(M, mode) {
    var order = { "Decision": 0, "Acknowledge": 1 };
    return M.issues.filter(function (i) {
      return i.open && (order[i.steer] != null) && (mode === "internal" || i.vis !== "Internal");
    }).sort(function (a, b) { return (order[a.steer] - order[b.steer]) || ((a.due == null ? 9e15 : a.due) - (b.due == null ? 9e15 : b.due)); });
  }
  function pageSteering(M, mode, n) {
    var it = steerItems(M, mode);
    var nd = it.filter(function (i) { return i.steer === "Decision"; }).length, na = it.length - nd;
    var h = '<section class="page">' + header(M, mode, "Items for Steering");
    h += '<div class="sg-sum"><div class="sg-k sg-dec"><b>' + nd + '</b><span>Decision needed<br><small>ขอให้ Steering ตัดสินใจ</small></span></div>' +
      '<div class="sg-k sg-ack"><b>' + na + '</b><span>For acknowledgement<br><small>ขอให้ Steering รับทราบ</small></span></div>' +
      '<div class="sg-note">Decision = ต้องการมติ / อนุมัติจากที่ประชุม · Acknowledge = แจ้งให้ทราบสถานะและแผนรับมือ</div></div>';
    h += '<table class="sg"><thead><tr><th class="sg-n">#</th><th class="sg-t">Topic</th><th>Details / current status</th><th class="sg-a">Ask from Steering</th><th class="sg-o">Owner · Due</th></tr></thead><tbody>' +
      it.map(function (i, k) {
        return '<tr><td class="sg-n">' + (k + 1) + '</td><td class="sg-t"><span class="sg-pill ' + (i.steer === "Decision" ? "p-dec" : "p-ack") + '">' + esc(i.steer) + "</span>" +
          '<div class="clamp3 b">' + esc(i.text) + "</div></td>" +
          '<td><div class="clamp3 muted">' + esc(i.action) + "</div></td>" +
          '<td class="sg-a"><div class="clamp3">' + (esc(i.ask) || '<span class="muted">–</span>') + "</div></td>" +
          '<td class="sg-o"><b>' + esc(i.owner) + "</b><br>" + (fmtD(i.due) || "–") + "</td></tr>";
      }).join("") + "</tbody></table>";
    return h + footer(M, mode, n) + "</section>";
  }

  // ---------- Upcoming activities calendar (5 weeks from the Monday of the report week)
  function ownerClass(o) {
    var u = String(o).toUpperCase(), hmc = u.indexOf("HMC") >= 0, cl = /\bHP\b|CLIENT/.test(u);
    if (u.indexOf("JOINT") >= 0 || (hmc && cl)) return "ow-j";
    return hmc ? "ow-h" : cl ? "ow-c" : "ow-j";
  }
  function pageCalendar(M, mode, n) {
    // 5-week look-ahead: one row per activity, bars on a day scale (weekends narrow), key dates as ◆
    var rd = M.rd, dow = (new Date(rd).getUTCDay() + 6) % 7, W = 5, ND = W * 7, WE = 0.35;
    var c0 = rd - dow * DAY, c1 = c0 + (ND - 1) * DAY;
    var wt = function (i) { return (i % 7) > 4 ? WE : 1; }, tot = 0, xs = [];
    for (var i = 0; i < ND; i++) { xs.push(tot); tot += wt(i); }
    var X = function (t) { var i = Math.round((t - c0) / DAY); return i <= 0 ? 0 : i >= ND ? 100 : xs[i] / tot * 100; };
    var XE = function (t) { var i = Math.round((t - c0) / DAY); return i < 0 ? 0 : i >= ND - 1 ? 100 : (xs[i] + wt(i)) / tot * 100; };
    var msIds = {}; M.milestones.forEach(function (m) { msIds[m.id] = true; });
    var acts = M.activities.filter(function (a) { return msIds[a.ms] && a.start != null && a.status !== "N/A"; });
    var curated = acts.some(function (a) { return a.label; });
    var items = acts.filter(function (a) {
      var e = a.end == null ? a.start : a.end;
      return (curated ? !!a.label : a.status !== "Done") && a.start <= c1 && e >= c0 && !(a.status === "Done" && e < rd);
    }).map(function (a) {
      var e = a.end == null ? a.start : a.end, t = a.label || a.name;
      return { s: a.start, e: e, t: t.length > 60 ? t.slice(0, 58) + "…" : t, full: a.name, cls: ownerClass(a.owner), one: e === a.start,
               done: a.status === "Done", late: a.status !== "Done" && e < rd };
    });
    var keys = items.filter(function (x) { return x.one; }).sort(function (a, b) { return a.s - b.s; });
    var rows = items.filter(function (x) { return !x.one; }).sort(function (a, b) { return (a.s - b.s) || (a.e - b.e); });
    var rng = function (x) { var a = new Date(x.s), b = new Date(x.e);
      return a.getUTCMonth() === b.getUTCMonth() ? a.getUTCDate() + "–" + b.getUTCDate() + " " + MON[b.getUTCMonth()] : short(x.s) + " – " + short(x.e); };
    // grid: week bands + weekend shading + report-date line
    var grid = "";
    for (var w = 0; w < W; w++) grid += '<i class="la-wk' + (w % 2 ? " odd" : "") + '" style="left:' + X(c0 + w * 7 * DAY) + "%;width:" + (XE(c0 + (w * 7 + 6) * DAY) - X(c0 + w * 7 * DAY)) + '%"></i>';
    for (var d = 0; d < ND; d++) if (d % 7 === 5) grid += '<i class="la-we" style="left:' + X(c0 + d * DAY) + "%;width:" + (XE(c0 + (d + 1) * DAY) - X(c0 + d * DAY)) + '%"></i>';
    grid += '<i class="la-rd" style="left:' + ((X(rd) + XE(rd)) / 2) + '%"></i>';
    // header: weeks + weekday numbers
    var wk = "", dn = "";
    for (w = 0; w < W; w++) {
      var ws = c0 + w * 7 * DAY, we = ws + 6 * DAY;
      wk += '<div class="la-wh" style="left:' + X(ws) + "%;width:" + (XE(we) - X(ws)) + '%"><b>' + (w === 0 ? "This week" : "Week +" + w) + "</b> " + dm(ws) + "–" + dm(we) + "</div>";
    }
    for (d = 0; d < ND; d++) if (d % 7 < 5) {
      var t = c0 + d * DAY;
      dn += '<span class="' + (t === rd ? "rd" : t < rd ? "past" : "") + '" style="left:' + X(t) + "%;width:" + (XE(t) - X(t)) + '%">' + new Date(t).getUTCDate() + "</span>";
    }
    var h = '<section class="page">' + header(M, mode, "Key Upcoming Activities");
    var ce = function (t, cls) { return '<div class="la-c' + (cls ? " " + cls : "") + '">' + (t == null ? "" : fmtD(t)) + "</div>"; };
    h += '<div class="cal-top"><div class="cal-rng">' + short(c0) + " – " + short(c1) + ' <span>· 5-week look-ahead</span></div>' +
      '<div class="cal-leg"><span><i class="ow-h"></i>HMC</span><span><i class="ow-c"></i>Client</span><span><i class="ow-j"></i>Joint</span>' +
      '<span><b class="la-dm ow-j"></b>Key date</span><span><i class="la-legrd"></i>Report date</span></div></div>';
    h += '<div class="la"><div class="la-r la-hd"><div class="la-l">Activity</div><div class="la-c">Start</div><div class="la-c">End</div><div class="la-t">' + wk + '<div class="la-dn">' + dn + "</div></div></div>";
    // key dates row
    if (keys.length) {
      var lv = [], kh = "";
      keys.forEach(function (k) {
        var x = (X(k.s) + XE(k.s)) / 2, L = 0;
        while (lv[L] != null && x - lv[L] < 17) L++;
        lv[L] = x;
        kh += '<div class="la-k ' + k.cls + '" style="left:' + x + "%;top:" + (6 + L * 22) + 'px" title="' + esc(k.full) + '"><b class="la-dm ' + k.cls + '"></b>' + esc(k.t) +
          ' <small>' + short(k.s) + "</small></div>";
      });
      h += '<div class="la-r la-key"><div class="la-l"><b>Key dates</b></div>' + ce(null) + ce(null) + '<div class="la-t" style="height:' + (14 + lv.length * 22) + 'px">' + grid + kh + "</div></div>";
    }
    rows.forEach(function (x) {
      var l = X(x.s), r = XE(x.e), lo = x.s < c0, ro = x.e > c1;
      h += '<div class="la-r' + (x.late ? " la-late" : "") + '"><div class="la-l"><i class="la-ow ' + x.cls + '"></i><span title="' + esc(x.full) + '">' + esc(x.t) + "</span></div>" +
        ce(x.s) + ce(x.e, x.late ? "late" : "") +
        '<div class="la-t">' + grid + '<div class="la-b ' + x.cls + (lo ? " lo" : "") + (ro ? " ro" : "") + (x.done ? " dn" : "") + '" style="left:' + l + "%;width:" + Math.max(r - l, 1.2) + '%"></div></div></div>';
    });
    if (!items.length) h += '<div class="la-r"><div class="la-l muted">–</div>' + ce(null) + ce(null) + '<div class="la-t">' + grid + "</div></div>";
    h += "</div>";
    if (!items.length) h += '<div class="tl-note">ไม่มี Activity ในช่วงนี้ · ใส่ Calendar Label (ชีท Plan คอลัมน์ X) เพื่อเลือกงานที่จะแสดง</div>';
    return h + footer(M, mode, n) + "</section>";
  }

  // ---------- Progress overview: S-curve plan vs actual · phases plan vs actual · milestones by status
  var HEX = { "Completed": "#2f6fde", "On Track": "#2e9e6b", "At Risk": "#e0a100", "Delayed": "#d64545", "Not Started": "#94a3b8" };
  function pageProgress(M, mode, n) {
    var C = M.chart;
    var h = '<section class="page">' + header(M, mode, "Progress Overview");
    // S-curve (full width) with the value of every month and the gap between plan and actual
    var Wd = 1040, Ht = 250, L = 40, R = 24, T = 18, B = 26, iw = Wd - L - R, ih = Ht - T - B, N = C.labels.length;
    var x = function (i) { return L + (N <= 1 ? iw / 2 : i * iw / (N - 1)); }, y = function (v) { return T + ih - v / 100 * ih; };
    var svg = '<svg viewBox="0 0 ' + Wd + " " + Ht + '" width="100%" style="display:block">';
    [0, 25, 50, 75, 100].forEach(function (g) { svg += '<line x1="' + L + '" x2="' + (Wd - R) + '" y1="' + y(g) + '" y2="' + y(g) + '" stroke="#e6ecf3"/><text x="' + (L - 6) + '" y="' + (y(g) + 3) + '" font-size="9" text-anchor="end" fill="#8796ab">' + g + "%</text>"; });
    C.labels.forEach(function (lb, i) { svg += '<text x="' + x(i) + '" y="' + (Ht - 8) + '" font-size="9.5" text-anchor="middle" fill="#5b6b82">' + esc(lb) + "</text>"; });
    var path = function (arr) { var d = "", on = false; arr.forEach(function (v, i) { if (v == null) { on = false; return; } d += (on ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1) + " "; on = true; }); return d; };
    // gap bars between plan and actual
    C.actual.forEach(function (a, i) { var p = C.plan[i]; if (a == null || p == null || a === p) return;
      svg += '<line x1="' + x(i) + '" x2="' + x(i) + '" y1="' + y(p) + '" y2="' + y(a) + '" stroke="' + (a < p ? "#d64545" : "#2e9e6b") + '" stroke-width="6" stroke-opacity=".22" stroke-linecap="round"/>'; });
    svg += '<path d="' + path(C.plan) + '" fill="none" stroke="#9fb8da" stroke-width="2.5" stroke-dasharray="6 4"/>';
    svg += '<path d="' + path(C.actual) + '" fill="none" stroke="#1b4f8f" stroke-width="3"/>';
    C.plan.forEach(function (p, i) { if (p == null) return; var a = C.actual[i], above = a == null || p >= a;
      svg += '<circle cx="' + x(i) + '" cy="' + y(p) + '" r="3" fill="#fff" stroke="#9fb8da" stroke-width="2"/>' +
        (!above && p < 8 ? '<text x="' + (x(i) + 7) + '" y="' + (y(p) - 3) + '" font-size="9.5" text-anchor="start" fill="#6f8bb0">' + p + "%</text>"   // too close to the axis: label to the right
          : '<text x="' + x(i) + '" y="' + (y(p) + (above ? -8 : 15)) + '" font-size="9.5" text-anchor="middle" fill="#6f8bb0">' + p + "%</text>"); });
    C.actual.forEach(function (a, i) { if (a == null) return; var p = C.plan[i], above = p == null || a > p;
      svg += '<circle cx="' + x(i) + '" cy="' + y(a) + '" r="4" fill="#1b4f8f"/>' +
        '<text x="' + x(i) + '" y="' + (y(a) + (above ? -9 : 16)) + '" font-size="10.5" font-weight="700" text-anchor="middle" fill="#0f2a4a">' + a + "%</text>"; });
    svg += "</svg>";
    // month table: plan · actual · gap
    var cellW = 'style="text-align:center;padding:3px 2px"';
    var tbl = '<table style="table-layout:fixed;margin-top:4px"><tbody>' +
      '<tr><td style="width:70px;font-weight:700;color:#6f8bb0;padding:3px 6px">Plan</td>' + C.plan.map(function (v) { return "<td " + cellW + ">" + (v == null ? "–" : v + "%") + "</td>"; }).join("") + "</tr>" +
      '<tr><td style="font-weight:700;color:#0f2a4a;padding:3px 6px">Actual</td>' + C.actual.map(function (v) { return "<td " + cellW + "><b>" + (v == null ? "–" : v + "%") + "</b></td>"; }).join("") + "</tr>" +
      '<tr><td style="font-weight:700;color:var(--mut);padding:3px 6px">Gap</td>' + C.actual.map(function (a, i) { var p = C.plan[i]; if (a == null || p == null) return "<td " + cellW + ">–</td>";
        var g = a - p; return '<td style="text-align:center;padding:3px 2px;font-weight:700;color:' + (g < 0 ? "#d64545" : g > 0 ? "#2e9e6b" : "#5b6b82") + '">' + (g > 0 ? "+" : "") + g + "</td>"; }).join("") + "</tr></tbody></table>";
    var legend = '<div class="stack-l" style="margin:0 0 2px"><span><i style="background:#9fb8da"></i>Plan</span><span><i style="background:#1b4f8f"></i>Actual</span>' +
      '<span><i style="background:#f5cfcf"></i>Behind plan</span><span><i style="background:#cdeadb"></i>Ahead of plan</span></div>';
    h += '<div class="card">' + title("Overall progress · plan vs actual by month") + legend + svg + tbl + "</div>";
    // phases: actual vs plan (one line each)
    var ph = C.phases.slice(0, 10).map(function (p) {
      var g = p.actual - p.planned;
      return '<div style="display:grid;grid-template-columns:230px 1fr 150px;gap:12px;align-items:center;margin:0 0 6px">' +
        '<div class="clamp" style="font-weight:600;font-size:11.5px">' + esc(p.name) + "</div>" +
        '<div style="position:relative;height:12px;border-radius:6px;background:#e3e9f1">' +
          '<div style="position:absolute;left:0;top:0;bottom:0;border-radius:6px;background:' + (HEX[p.status] || "#1b4f8f") + ";width:" + p.actual + '%"></div>' +
          '<div title="Plan" style="position:absolute;top:-3px;bottom:-3px;width:3px;border-radius:2px;background:#0f2a4a;left:calc(' + p.planned + '% - 1px)"></div></div>' +
        '<div style="font-size:11px;color:var(--mut);text-align:right"><b style="color:var(--ink)">' + p.actual + '%</b> / plan ' + p.planned + '% · <b style="color:' + (g < 0 ? "#d64545" : g > 0 ? "#2e9e6b" : "#5b6b82") + '">' + (g > 0 ? "+" : "") + g + "</b></div></div>";
    }).join("") || '<div class="muted">No phases</div>';
    h += '<div class="card">' + title("Phase progress · actual vs plan") +
      '<div class="stack-l" style="margin:0 0 8px"><span><i style="background:#1b4f8f"></i>Actual (colour = status)</span><span><i style="background:#0f2a4a;width:3px"></i>Plan at report date</span></div>' + ph + "</div>";
    // milestones by status (project vs billing)
    var bar = function (label, c) {
      var tot = 0; STATUS.forEach(function (s) { tot += c[s] || 0; });
      return '<div style="display:grid;grid-template-columns:150px 1fr 60px;gap:10px;align-items:center;margin:0 0 6px"><b style="font-size:12px">' + label + '</b>' +
        (tot ? '<div class="stack">' + STATUS.map(function (s) { return c[s] ? '<span class="' + SCLASS[s] + '" style="flex:' + c[s] + ';display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:700">' + c[s] + "</span>" : ""; }).join("") + "</div>"
          : '<div class="muted" style="font-size:11px">None</div>') + '<div style="font-size:11px;color:var(--mut);text-align:right">' + tot + " total</div></div>";
    };
    h += '<div class="card">' + title("Milestones by status") + bar("Project milestones", C.milestones.project || {}) + bar("Billing milestones", C.milestones.billing || {}) +
      '<div class="stack-l">' + STATUS.map(function (s) { return '<span><i class="' + SCLASS[s] + '"></i>' + s + "</span>"; }).join("") + "</div></div>";
    return h + footer(M, mode, n) + "</section>";
  }

  function pageMilestones(M, mode, n) {
    var keyMs = M.milestones.filter(function (m) { return m.key; });
    var half = Math.ceil(keyMs.length / 2);
    var tbl = function (arr) {
      return '<table class="mst"><thead><tr><th>Milestone</th><th>Target</th><th>Progress</th><th>Status</th></tr></thead><tbody>' +
        arr.map(function (m) {
          return "<tr><td>" + esc(m.name) + '</td><td class="nowrap">' + fmtD(m.end) + '</td><td class="nowrap">' + bar(m.pct, m.status) +
            '<span class="pv">' + fmtP(m.pct) + "</span></td><td>" + chip(m.status) + "</td></tr>";
        }).join("") + "</tbody></table>";
    };
    return '<section class="page">' + header(M, mode, "Key Milestone Tracker") +
      '<div class="cols2">' + tbl(keyMs.slice(0, half)) + tbl(keyMs.slice(half)) + "</div>" + footer(M, mode, n) + "</section>";
  }

  function pageTimeline(M, mode, n) {
    var dated = M.phases.filter(function (p) { return p.start != null && p.end != null; });
    var ph = M.phases.length ? M.phases : dated;
    var h = '<section class="page">' + header(M, mode, "Overall Project Timeline");
    if (!ph.length) return h + '<div class="tl-note">ยังไม่มี Phase ในชีท Plan</div>' + footer(M, mode, n) + "</section>";
    var t0 = dated.length ? Math.min.apply(null, dated.map(function (p) { return p.start; })) : M.rd;
    var t1 = dated.length ? Math.max.apply(null, dated.map(function (p) { return p.end; })) : M.rd + 330 * DAY;
    var d0 = new Date(t0), d1 = new Date(t1);
    var start = Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), 1);
    var end = Date.UTC(d1.getUTCFullYear(), d1.getUTCMonth() + 1, 1);
    var months = [];
    for (var y = d0.getUTCFullYear(), mo = d0.getUTCMonth(); Date.UTC(y, mo, 1) < end; mo++) {
      if (mo > 11) { mo = 0; y++; }
      months.push({ t: Date.UTC(y, mo, 1), label: MON[mo] + (mo === 0 || !months.length ? " '" + String(y).slice(2) : "") });
    }
    var span = end - start;
    var X = function (t) { return ((t - start) / span * 100).toFixed(3) + "%"; };
    var today = M.rd >= start && M.rd <= end ? X(M.rd) : null;
    var grid = months.map(function (m) { return '<i style="left:' + X(m.t) + '"></i>'; }).join("");

    h += '<div class="tl"><div class="tl-row tl-head"><div>Phase</div><div class="c">Done</div><div>Status</div><div class="gantt gh">' +
      months.map(function (m, i) {
        var w = ((i < months.length - 1 ? months[i + 1].t : end) - m.t) / span * 100;
        return '<span style="left:' + X(m.t) + ";width:" + w.toFixed(3) + '%">' + m.label + "</span>";
      }).join("") + (today ? '<b class="here" style="left:' + today + '">Today</b>' : "") + "</div></div>";
    ph.forEach(function (p) {
      var cls = SCLASS[p.status] || "s-ns";
      var g = '<div class="gantt">' + grid + (p.start == null || p.end == null ? "" : p.start === p.end
        ? '<span class="dia ' + cls + '" style="left:' + X(p.start + DAY / 2) + '"></span>'
        : '<span class="gbar ' + cls + '" style="left:' + X(p.start) + ";width:" + ((p.end + DAY - p.start) / span * 100).toFixed(3) +
          '%"><span class="gfill" style="width:' + fmtP(p.pct) + '"></span></span>') +
        (today ? '<span class="today" style="left:' + today + '"></span>' : "") + "</div>";
      h += '<div class="tl-row"><div><div class="pn">' + esc(p.name) + '</div><div class="pd">' + (p.start == null ? "– ยังไม่ระบุวันที่ –" : fmtD(p.start) + (p.start === p.end ? "" : " – " + fmtD(p.end))) +
        " · " + esc(p.owner) + '</div></div><div class="c b ' + cls + 't">' + (p.pct || p.status !== "Not Started" ? fmtP(p.pct) : "–") +
        '</div><div class="nowrap">' + dot(p.status) + ' <span class="stx">' + esc(p.status) + "</span></div>" + g + "</div>";
    });
    h += '</div><div class="tl-note">Light bar = planned window · solid fill = % completed · yellow line = report date (' + fmtD(M.rd) + ")</div>";
    return h + footer(M, mode, n) + "</section>";
  }

  function pageBilling(M, mode, n) {
    var B = M.billing, P = M.P;
    var h = '<section class="page">' + header(M, mode, "Billing & Payment Status");
    if (!B.length) return h + "<p>No billing data.</p>" + footer(M, mode, n) + "</section>";
    var tot = 0, paid = 0, inv = 0, over = 0, ready = 0, late = 0, pend = 0;
    B.forEach(function (b) {
      tot += b.amount;
      if (b.status === "Paid") paid += b.paidAmt || b.amount;
      else if (b.status === "Invoiced") inv += b.amount;
      else if (b.status === "Overdue") over += b.amount;
      else if (b.status === "Ready to Invoice") ready += b.amount;
      else if (b.status === "Milestone Delayed") late += b.amount;
      else pend += b.amount;
    });
    var cur = esc(P.currency);
    var M_ = function (v) { return v >= 1e6 ? (v / 1e6).toFixed(2).replace(/\.?0+$/, "") + "<small>M</small>" : v >= 1e3 ? Math.round(v / 1e3) + "<small>K</small>" : money(v); };
    var pc = function (v) { return tot ? Math.round(v / tot * 100) + "% of contract" : ""; };
    var tile = function (k, v, cls, s) { return '<div class="tile ' + (cls || "") + '"><div class="tl-k">' + k + '</div><div class="big">' + M_(v) + '</div><div class="tl-s">' + s + "</div></div>"; };
    h += '<div class="hero h5">' + tile("Contract value (" + cur + ")", tot, "", Object.keys(M.fees).length + " fee types") +
      tile("Collected", paid, "t-done", pc(paid)) + tile("Outstanding invoices", inv + over, over ? "t-late" : "t-ok", over ? money(over) + " overdue" : "none overdue") +
      tile("Ready to invoice now", ready, ready ? "t-risk" : "", ready ? "milestone completed" : "nothing pending") +
      tile("At risk – milestone late", late, late ? "t-late" : "", pc(late)) + "</div>";
    var seg = function (v, cls, l) { return v > 0 ? '<span class="' + cls + '" style="width:' + (v / tot * 100).toFixed(2) + '%" title="' + l + ": " + money(v) + '"></span>' : ""; };
    h += '<div><div class="stack">' + seg(paid, "s-done", "Collected") + seg(inv, "s-ok", "Invoiced") + seg(over, "s-late", "Overdue") +
      seg(ready, "s-risk", "Ready") + seg(late, "s-late hatch", "Milestone delayed") + seg(pend, "s-ns", "Pending") + "</div>" +
      '<div class="stack-l">' + [["s-done", "Collected"], ["s-ok", "Invoiced"], ["s-late", "Overdue"], ["s-risk", "Ready to invoice"],
        ["s-late hatch", "Milestone delayed"], ["s-ns", "Pending milestone"]].map(function (x) {
        return '<span><i class="' + x[0] + '"></i>' + x[1] + "</span>"; }).join("") + "</div></div>";

    var actions = B.filter(function (b) { return /Ready|Overdue|Milestone Delayed/.test(b.status); });
    if (actions.length) {
      h += '<div class="card">' + title("Action needed", "c-late") + '<ul class="att">' + actions.map(function (b) {
        var why = b.status === "Ready to Invoice" ? "Milestone completed – issue invoice now"
          : b.status === "Overdue" ? "Invoice " + esc(b.invNo) + " overdue since " + fmtD(b.due) + " – follow up payment"
          : "Waiting on “" + esc(b.msName) + "” (target " + fmtD(b.msEnd) + ", " + fmtP(b.msPct) + " done)";
        return "<li>" + dot(b.status, BCLASS[b.status]) + '<div><div class="an">' + esc(b.fee) + " · งวดที่ " + esc(b.inst) +
          ' <span class="amt">' + money(b.amount) + " " + cur + '</span></div><div class="as">' + why + "</div></div></li>";
      }).join("") + "</ul></div>";
    }
    var groups = [];
    B.forEach(function (b) { if (groups.indexOf(b.fee) < 0) groups.push(b.fee); });
    h += '<div class="card"><table class="bill"><thead><tr><th>งวด</th><th class="r">Amount (' + cur + ')</th><th>Trigger milestone</th><th>Target</th><th>Invoice / payment</th><th>Status</th></tr></thead><tbody>';
    groups.forEach(function (g) {
      var items = B.filter(function (b) { return b.fee === g; });
      var sub = items.reduce(function (s, b) { return s + b.amount; }, 0);
      h += '<tr class="grp"><td colspan="6">' + esc(g) + ' <span>' + money(sub) + " " + cur + " · " +
        items.map(function (b) { return Math.round(b.pct * 100); }).join("/") + "</span></td></tr>";
      items.forEach(function (b) {
        var pay = b.paidDate ? "Paid " + fmtD(b.paidDate) : b.invDate ? esc(b.invNo) + " · due " + fmtD(b.due) : "–";
        h += '<tr><td class="c">' + esc(b.inst) + " <span class=muted>(" + fmtP(b.pct) + ')</span></td><td class="r b">' + money(b.amount) +
          "</td><td>" + esc(b.msName) + ' <span class="mini">' + bar(b.msPct, b.msStatus) + fmtP(b.msPct) + '</span></td><td class="nowrap">' +
          fmtD(b.msEnd) + '</td><td class="nowrap">' + pay + "</td><td>" + chip(b.status, BCLASS) + "</td></tr>";
      });
    });
    h += "</tbody></table></div>";
    return h + footer(M, mode, n) + "</section>";
  }

  function pageActivities(M, mode, n) {
    var rd = M.rd;
    var acts = M.activities.filter(function (a) { return M.milestones.some(function (m) { return m.id === a.ms; }); });
    var recent = acts.filter(function (a) { return a.finish != null && a.finish <= rd && a.finish > rd - 7 * DAY; });
    var dueSoon = acts.filter(function (a) { return a.status !== "Done" && a.status !== "N/A" && a.end != null && a.end >= rd && a.end <= rd + 14 * DAY; });
    var overdue = acts.filter(function (a) { return a.status !== "Done" && a.status !== "N/A" && a.end != null && a.end < rd; });
    var li = function (a, d) { return '<li><div class="an">' + esc(a.name) + '</div><div class="as">' + esc(a.owner) + " · " + d + "</div></li>"; };
    var LIM = 6;
    var col = function (t, cls, arr, f) {
      return '<div class="card">' + title(t + ' <span class="cnt">' + arr.length + "</span>", cls) + '<ul class="al">' +
        (arr.map(function (a, i) { return xtra(f(a), i, LIM); }).join("") || '<li class="muted">–</li>') + "</ul>" + more(arr.length - LIM) + "</div>";
    };
    var h = '<section class="page">' + header(M, mode, "Activity Breakdown");
    h += '<div class="cols3">' + col("Finished last 7 days", "c-done", recent, function (a) { return li(a, "done " + fmtD(a.finish)); }) +
      col("Due next 14 days", "c-ok", dueSoon, function (a) { return li(a, "due " + fmtD(a.end) + " · " + fmtP(a.eff)); }) +
      col("Overdue, not done", "c-late", overdue, function (a) { return li(a, "due " + fmtD(a.end) + " · " + fmtP(a.eff)); }) + "</div>";
    // state of each activity as at the report date
    var ST = {
      done: ["Done", "a-done", "✓ Done"], prog: ["In Progress", "a-prog", "In Progress"], behind: ["Behind plan", "a-behind", "Behind"],
      late: ["Overdue", "a-late", "Overdue"], lstart: ["Late start", "a-behind", "Late start"], ns: ["Not Started", "a-ns", "Not Started"],
      hold: ["On Hold", "a-hold", "On Hold"], na: ["N/A", "a-na", "N/A"]
    };
    var stateOf = function (a) {
      if (a.status === "N/A") return "na";
      if (a.status === "Done") return "done";
      if (a.status === "On Hold") return "hold";
      if (a.end != null && a.end < rd) return "late";
      if (a.status === "Not Started" || !a.status) return (a.start != null && a.start < rd) ? "lstart" : "ns";
      return planned(rd, a.start, a.end) - a.eff > M.P.tol ? "behind" : "prog";
    };
    var cnt = {}; Object.keys(ST).forEach(function (k) { cnt[k] = 0; });
    M.milestones.forEach(function (m) { m.acts.forEach(function (a) { a._st = stateOf(a); cnt[a._st]++; }); });
    h += '<div class="ast">' + ["done", "prog", "behind", "lstart", "late", "ns", "hold"].filter(function (k) { return cnt[k]; }).map(function (k) {
      return '<span class="ast-i ' + ST[k][1] + '"><b>' + cnt[k] + "</b>" + ST[k][0] + "</span>";
    }).join("") + '<span class="ast-n">Behind = ช้ากว่าแผนตามเวลาเกิน ' + Math.round(M.P.tol * 100) + "% · Overdue = เลยวันสิ้นสุดแล้วยังไม่เสร็จ</span></div>";
    h += '<div class="card ac-card"><table class="acts"><thead><tr><th>Activity</th><th>Owner</th><th>Plan</th><th class="c">Wt</th><th>Status</th><th>Progress</th><th>Remark</th></tr></thead><tbody>';
    M.milestones.forEach(function (m) {
      if (!m.acts.length) return;
      h += '<tr class="grp"><td colspan="7"><span class="g-name">' + dot(m.status) + " " + esc(m.name) + "</span>" + chip(m.status) +
        '<span class="g-bar">' + bar(m.pct, m.status) + '<b>' + fmtP(m.pct) + "</b></span>" +
        '<span class="g-tg">target ' + (m.end != null ? short(m.end) : "–") + "</span></td></tr>";
      m.acts.forEach(function (a) {
        var k = a._st, st = ST[k], lateDays = k === "late" ? Math.round((rd - a.end) / DAY) : 0;
        h += '<tr class="ar ' + st[1] + '"><td class="a-nm">' + esc(a.name) + "</td><td>" + esc(a.owner) + '</td><td class="nowrap">' + short(a.start) + " – " +
          (k === "late" ? '<b class="s-latet">' + short(a.end) + "</b>" : short(a.end)) +
          '</td><td class="c">' + esc(a.weight) + '</td><td class="nowrap"><span class="achip ' + st[1] + '">' + st[2] + "</span>" +
          (lateDays ? '<div class="a-ld">+' + lateDays + " days</div>" : "") +
          '</td><td class="nowrap"><span class="abar"><i class="' + st[1] + '" style="width:' + Math.round(a.eff * 100) + '%"></i></span><b class="apv">' + fmtP(a.eff) + "</b>" +
          '</td><td class="a-rm"><div class="clamp" title="' + esc(a.remark) + '">' + esc(a.remark) + "</div></td></tr>";
      });
    });
    h += "</tbody></table></div>";
    return h + footer(M, mode, n) + "</section>";
  }


  // =====================================================================================
  // Kick-off – shared content + logic (used by the HTML preview AND pptx-export.js so both always match)
  // =====================================================================================
  var EN_MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  function enDate(t) { if (t == null) return "–"; var d = new Date(t); return d.getUTCDate() + " " + EN_MON[d.getUTCMonth()] + " " + d.getUTCFullYear(); }
  function dShort(t) { if (t == null) return "–"; var d = new Date(t); return d.getUTCDate() + "-" + MON[d.getUTCMonth()] + "-" + String(d.getUTCFullYear()).slice(2); }
  var KO = {
    AGENDA: ["OBJECTIVES OF TODAY'S MEETING", "SCOPE OF WORK AND KEY BENEFITS", "PROJECT METHODOLOGY", "PROJECT TEAM AND GOVERNANCE", "OVERALL PROJECT TIMELINE", "KEY SUCCESS FACTORS", "NEXT STEPS"],
    PARTS: ["THE OBJECTIVES OF TODAY'S MEETING", "SCOPE OF WORK AND KEY BENEFITS", "PROJECT METHODOLOGY", "PROJECT TEAM AND GOVERNANCE", "OVERALL PROJECT TIMELINE", "KEY SUCCESS FACTORS", "NEXT STEPS"],
    ROMAN: ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"],
    OBJ: ["Share the overall project scope, key activities and methodology", "Share project timelines and align on key next steps"],
    BENEFITS: ["Cost Effective", "Standard Processes", "Standard Policies", "Enhanced Employee Experience", "Comprehensive and Accurate Database", "Access to Real-Time Reports and Insights",
      "Increased Work Productivity and Efficiency", "Anywhere, Any Time Access", "Consistent Program / Feature Updates", "Increased System Security and Reliability",
      "Seamless Integration Between Web and Mobile", "Improved Operational Management"],
    method: function (po) {
      return [["PLAN & SCOPE", ["Create Project Plan", "Kick-Off", "Cloud Preparation"]], ["DISCOVER", ["Gather Requirements", "Gap Analysis", "Confirm Business Blueprint"]],
        ["DEVELOP", ["System Configuration", "System Customization", "System Integration", "Unit Testing"]],
        ["DEPLOY", po ? ["Data Migration", "UAT", "Payroll Parallel Run Testing"] : ["Data Migration", "UAT", "Train the Trainer", "Payroll Parallel Run Testing"]], ["DELIVER", ["Go-Live", "Post-Support"]]];
    },
    isPO: function (P) { return /\bPO\b|outsourc/i.test(P.model || "") && !/\bPE\b|SaaS|ESS/i.test(P.model || ""); },
    METHOD_TINT: ["9DB5E3", "6F95D8", "4472C4", "2F5597", "13284C"],
    GOV_TIERS: [["5%", "Steering Committee", "Scope, Timeline, Budget,\nResources, Quality, Risks"], ["15%", "Project Advisors", "Solutions"], ["80%", "Project Team", "Risks & Escalations"]],
    GOV_BOX: [["CRITICAL SUCCESS FACTORS", ["Timely decisions", "Strong governance", "Engaged executives", "Cooperative team members"]],
      ["KEY PRINCIPLES", ["Proactive issues and risk management", "Effective decision making", "Project update consistency"]]],
    KSF: ["Project team commitment and alignment on goals, timelines and deliverables.", "Clear and defined project plan and activities.",
      "Consistent and transparent communications on changes, risks, issues (where required).", "Regular checkpoints, project tracking and updates.",
      "Efficient and effective decision making from the steering committee / project advisors."],
    OWN: { S01: "Joint", S02: "HMC", S03: "Joint", S04: "Client", S05: "HMC", S06: "HMC", S07: "Joint", S08: "Joint", S09: "Joint", S10: "Joint", S11: "Joint", S12: "HMC", S13: "Joint", S14: "HMC" },
    DEL: { S01: "Baseline project plan / RAID log", S02: "Cloud environment ready", S03: "Requirement & Fit/Gap log", S04: "Signed Business Blueprint", S05: "Configured system",
      S06: "Functional design / interface spec", S07: "Data migration templates", C01: "Change impact assessment", C02: "Change & communication plan", C03: "Change ambassador list" },
    RISKS: [["Client's team does not have the authorization to make decisions.", "Define their roles and responsibilities in advance.", "Medium", "High", "Project plan"],
      ["Change of system requirements", "Clearly define the scope of work in each phase.", "Medium", "High", "Project plan, Additional fees"],
      ["Data availability / delayed data preparation", "Evaluate data availability before entering data.", "Medium", "High", "Project plan, Additional fees"],
      ["Inaccurate customer data", "Thorough check of information before and after data migration.", "High", "Medium", "Project plan, Additional fees"],
      ["Team change / lack of workforce", "Plan resources in advance and focus on the highest priorities.", "Medium", "Medium", "Project plan"],
      ["Delay in project verification", "Identify the problems when work does not meet the schedule.", "Medium", "High", "Project plan"],
      ["Customer changes the procedure or document format in operation.", "Any modification in formatting is counted as a change.", "Low", "Medium", "Project plan, Additional fees"],
      ["Hardware system does not meet the standard.", "Provide hardware that meets the specifications required by HMC.", "Low", "Medium", ""],
      ["Task increase due to user inconvenience.", "Major extra tasks are counted as additional tasks.", "Medium", "Low", "Additional fees"],
      ["Customer does not facilitate information verification.", "Clearly identify all necessary procedures to the customer.", "Low", "Low", ""]],
    RR: [["STEERING COMMITTEE", "Set policy and priorities, approve scope and policy-level changes · Review goals, progress, costs and timeline · Resolve conflicts and make decisions"],
      ["PROJECT ADVISOR", "Give advice and review the overall project · Analyze project risks"],
      ["PROJECT MANAGER", "Plan, manage and control the project with the client PM · Focal point for all project activities · Control costs, risks and tasks · Report progress to the committee"],
      ["FUNCTIONAL TEAM", "Analyze requirements and match them with the system · Define business processes and company policy with the client · Conduct end-user training"],
      ["TECHNICAL TEAM", "Develop requirements beyond the standard · Support and resolve technical issues · Coordinate connectivity with the client's technical team"]],
    DOCS: [["Project Agenda", "Prepare the information, documents and persons involved in the meeting.", "Before the meeting"],
      ["Minutes of Meeting", "Summarize what happened during the meeting and acknowledgement sign.", "After every meeting"],
      ["Project Issue", "Issue case, clarification, escalation guideline and action plan.", "Problem occurs"],
      ["Project Issue Log", "Change request documents, issue tracking, escalation and resolution.", "Problem occurs"],
      ["Project Change Request", "Scope modification or additional details after Business Blueprint confirmation.", "Submission of the change request"],
      ["Project Deliverable Sign-off", "Approval documents confirming each work process.", "According to delivery list"],
      ["Project Status Report", "Status update including timeline and missed milestones.", "Every 2 weeks"],
      ["Training Attendees", "Signed attendance for system usage training.", "Every training class"],
      ["Customer Service Sheet", "Job completion documents for HMC operations working period.", "Every time of working"]],
    SYSREQ: [["Web browser", "Google Chrome (recommended) · Microsoft Edge · Mozilla Firefox · Safari – latest versions"],
      ["Mobile OS", "iOS and Android – versions supported by the mobile application"],
      ["Single Sign-On", "SAML 2.0 · OAuth2 · ADFS · Azure AD · Google Workspace"]],
    // modules of a phase split into Core HR (centre panel) and the rest (side cards)
    scope: function (K, ph) {
      var ms = K.modules.filter(function (m) { return m.name && m.phase === ph; });
      return { all: ms, core: ms.filter(function (m) { return /core/i.test(m.group); }), other: ms.filter(function (m) { return !/core/i.test(m.group); }) };
    },
    ints: function (K) { var a = K.integrations.filter(function (x) { return x.system; }); var n = Math.ceil(a.length / 10) || 1, per = Math.ceil(a.length / n) || 1, out = [];
      for (var i = 0; i < a.length; i += per) out.push(a.slice(i, i + per)); return out; },
    // team pages: both sides share a slide (14 each); once one side runs out, the other gets the full width (28)
    teamPages: function (K) {
      var order = ["Steering Committee", "Project Sponsor", "Project Advisor", "Project Manager", "Project Lead", "Key User", "Change Management", "Module Lead", "Functional", "Technical"];
      var rank = function (t) { var i = order.indexOf(t.role); return i < 0 ? 99 : i; };
      var team = K.team.filter(function (t) { return t.name; });
      if (!team.length) return [];
      var cl = team.filter(function (t) { return t.side !== "HMC"; }).sort(function (a, b) { return rank(a) - rank(b); });
      var hm = team.filter(function (t) { return t.side === "HMC"; }).sort(function (a, b) { return rank(a) - rank(b); });
      var PG = [], ci = 0, hi = 0;
      while (ci < cl.length || hi < hm.length) {
        if (ci < cl.length && hi < hm.length) { PG.push([[cl.slice(ci, ci + 14), 0], [hm.slice(hi, hi + 14), 1]]); ci += 14; hi += 14; }
        else if (ci < cl.length) { PG.push([[cl.slice(ci, ci + 28), 0]]); ci += 28; }
        else { PG.push([[hm.slice(hi, hi + 28), 1]]); hi += 28; }
      }
      return PG;
    },
    // org-chart tiers: Steering Committee → Project Advisors → Project Leads → Project Team → Technical Team
    orgTiers: function (K) {
      var T = [["steer", "Steering Committee", "คณะกรรมการบริหารโครงการ"], ["adv", "Project Advisors", "ที่ปรึกษาโครงการ"], ["lead", "Project Leads", "ผู้นำโครงการ"],
               ["team", "Project Team", "ทีมงานโครงการ"], ["tech", "Technical Team", "ทีมเทคนิค"]];
      var tierOf = function (t) { var r = String(t.role || "");
        if (/steer|sponsor|executive|กรรมการ|ผู้สนับสนุน/i.test(r)) return "steer";
        if (/advis|ที่ปรึกษา/i.test(r)) return "adv";
        if (/technical|\btech|\bit\b|infra|develop|integration|เทคนิค|ไอที/i.test(r)) return "tech";
        if (/project manager|project lead|\bpm\b|ผู้จัดการโครงการ|หัวหน้าโครงการ/i.test(r)) return "lead";
        return "team"; };
      var team = (K.team || []).filter(function (t) { return t.name; });
      return T.map(function (x) {
        var ppl = team.filter(function (t) { return tierOf(t) === x[0]; });
        return { key: x[0], label: x[1], th: x[2], client: ppl.filter(function (t) { return t.side !== "HMC"; }), hmc: ppl.filter(function (t) { return t.side === "HMC"; }) };
      });
    },
    initial: function (name) { return (String(name).replace(/^(นาย|นางสาว|นาง|Mr\.|Ms\.|Mrs\.)\s*/i, "").trim().charAt(0) || "?").toUpperCase(); },
    // timeline axis: weekly when the phase is ≤ ~4 months, else monthly
    timeline: function (K, key) {
      var st = K.stages.filter(function (s0) { return s0[key] && s0.stream === "Implementation"; });
      if (!st.length) return null;
      var t0 = Math.min.apply(null, st.map(function (x) { return x[key][0]; })), t1 = Math.max.apply(null, st.map(function (x) { return x[key][1]; }));
      var weekly = (t1 - t0) / DAY <= 130, d0 = new Date(t0), d1 = new Date(t1);
      var start = weekly ? t0 - ((d0.getUTCDay() + 6) % 7) * DAY : Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), 1);
      var end = weekly ? t1 + (7 - ((d1.getUTCDay() + 6) % 7)) * DAY : Date.UTC(d1.getUTCFullYear(), d1.getUTCMonth() + 1, 1);
      var cols = []; if (weekly) for (var t = start; t < end; t += 7 * DAY) cols.push(t); else for (var y = d0.getUTCFullYear(), mo = d0.getUTCMonth(); Date.UTC(y, mo, 1) < end; mo++) { if (mo > 11) { mo = 0; y++; } cols.push(Date.UTC(y, mo, 1)); }
      var label = function (c) { var dc = new Date(c); return weekly ? dc.getUTCDate() + " " + MON[dc.getUTCMonth()] : MON[dc.getUTCMonth()] + " '" + String(dc.getUTCFullYear()).slice(2); };
      return { st: st, start: start, end: end, cols: cols, label: label, weekly: weekly };
    },
    // calendar of the kick-off month: ▶ stage starts, ◆ early stages done, ★ kick-off
    calendar: function (K) {
      if (K.kickoff == null) return null;
      var kd = new Date(K.kickoff), m0 = Date.UTC(kd.getUTCFullYear(), kd.getUTCMonth(), 1), mEnd = Date.UTC(kd.getUTCFullYear(), kd.getUTCMonth() + 1, 0);
      var ev = {}, add = function (t, txt, kind) { var k0 = String(t); (ev[k0] = ev[k0] || []).push({ t: txt, k: kind }); };
      K.stages.forEach(function (x) { if (!x.p1 || x.stream === "Span") return;
        if (x.p1[0] >= m0 && x.p1[0] <= mEnd) add(x.p1[0], "▶ " + stageName(x), x.stream === "Change" ? "chg" : "start");
        if (x.p1[1] >= m0 && x.p1[1] <= mEnd && x.p1[1] !== x.p1[0] && /S0[1-4]|S13/.test(x.id)) add(x.p1[1], "◆ " + stageName(x) + " – done", "done"); });
      add(K.kickoff, "★ Project Kick-off", "ko");
      var dow0 = (new Date(m0).getUTCDay() + 6) % 7, days = new Date(mEnd).getUTCDate();
      return { title: EN_MON[kd.getUTCMonth()] + " " + kd.getUTCFullYear(), m0: m0, days: days, dow0: dow0, weeks: Math.ceil((dow0 + days) / 7), ev: ev };
    },
    nextSteps: function (K) {
      if (K.kickoff == null) return [];
      return K.stages.filter(function (x) { return x.p1 && x.stream !== "Span" && x.p1[0] <= K.kickoff + 42 * DAY && x.p1[1] >= K.kickoff && (K.change || x.stream !== "Change"); }).slice(0, 10);
    }
  };

  // ---------- Project Charter model (shared by HTML + PPT): Charter sheet + values pulled from Project / Kickoff / Schedule / Billing
  var CHR = {
    RACI_ROLES: ["Steering Committee", "Client PM", "HMC PM", "Key Users / Module Leads", "HMC Functional", "HMC Technical"],
    RACI: [["Project Charter & Plan", "A", "C", "R", "I", "I", "I"], ["Requirements & Business Blueprint", "A", "R", "C", "C", "R", "I"],
      ["Configuration & Unit Test", "I", "C", "A", "C", "R", "C"], ["Interfaces & Customization", "I", "C", "A", "C", "C", "R"],
      ["Data Migration", "I", "A", "C", "R", "C", "R"], ["UAT & SIT", "I", "A", "C", "R", "C", "C"], ["Training", "I", "A", "C", "R", "R", "I"],
      ["Change Requests", "A", "R", "R", "C", "C", "C"], ["Go / No-Go Decision", "A", "R", "R", "C", "C", "C"], ["Hypercare & Handover", "I", "C", "A", "C", "R", "R"]],
    RACI_KEY: [["R", "Responsible", "does the work"], ["A", "Accountable", "one owner, signs off"], ["C", "Consulted", "two-way input"], ["I", "Informed", "kept up to date"]],
    // role → [influence, interest] for the stakeholder map when the Stakeholder table is empty
    ROLE_MAP: { "Steering Committee": ["High", "High"], "Project Sponsor": ["High", "High"], "Project Advisor": ["High", "Medium"], "Project Manager": ["High", "High"],
      "Project Lead": ["Medium", "High"], "Change Management": ["Medium", "High"], "Key User": ["Low", "High"], "Module Lead": ["Low", "High"], "Functional": ["Low", "High"], "Technical": ["Low", "Medium"] },
    QUAD: [["Keep Satisfied", "High influence · lower interest", "ksat"], ["Manage Closely", "High influence · high interest", "mcl"], ["Monitor", "Lower influence · lower interest", "mon"], ["Keep Informed", "Lower influence · high interest", "kinf"]],
    KEY_STAGES: [["S01", 0, "Kick-off"], ["S04", 1, "Business Blueprint sign-off"], ["S08", 1, "UAT & SIT complete"], ["S09", 1, "Payroll parallel run"], ["S13", 0, "Go-live"], ["S14", 1, "Hypercare closed"]]
  };
  function charterModel(M) {
    var C0 = M.charter, K = M.kickoff, P = M.P;
    if (!C0) return null;
    var team = K ? K.team.filter(function (t) { return t.name; }) : [];
    var first = function (role, side) { var t = team.filter(function (x) { return x.role === role && (side === "HMC" ? x.side === "HMC" : x.side !== "HMC"); })[0]; return t ? t.name : ""; };
    var C = Object.assign({}, C0);
    C.client = P.client || "Client"; C.vendor = P.vendor || "HUMANICA";
    C.date = C0.date != null ? C0.date : (K && K.kickoff != null ? K.kickoff : M.rd);
    C.sponsorC = C0.sponsorC || first("Steering Committee", "Client") || first("Project Sponsor", "Client");
    C.sponsorH = C0.sponsorH || first("Steering Committee", "HMC") || first("Project Sponsor", "HMC");
    C.pmC = C0.pmC || first("Project Manager", "Client"); C.pmH = C0.pmH || first("Project Manager", "HMC") || P.lead || "";
    C.purposeAuto = !C0.purpose; C.caseAuto = !C0.businessCase;
    C.purpose = C0.purpose || (LANG === "th" ? "ส่งมอบ " + (P.name || "ระบบ HR ใหม่") + " ให้ " + C.client + " – แพลตฟอร์มเดียวสำหรับงาน HR เงินเดือน และ Self-service พร้อมใช้งานตามวันที่กำหนด"
      : "Deliver " + (P.name || "the new HR platform") + " for " + C.client + " – one integrated platform for HR, payroll and self-service, live on the committed date.");
    C.businessCase = C0.businessCase || "";
    // scope (in) from Kickoff
    var phases = [["Phase 1", K && K.golive1, K && K.start1], ["Phase 2", K && K.golive2, K && K.start2]].filter(function (p) { return p[1] != null; });
    C.phases = phases.map(function (p) {
      return { name: p[0], golive: p[1], start: p[2], modules: K.modules.filter(function (m) { return m.name && m.phase === p[0]; }),
        ints: K.integrations.filter(function (x) { return x.system && x.phase === p[0]; }) };
    });
    C.modulesAll = K ? K.modules.filter(function (m) { return m.name; }) : [];
    C.intsAll = K ? K.integrations.filter(function (x) { return x.system; }) : [];
    // deliverables: due = end of the linked Schedule stage (per phase)
    var stage = {}; if (K) K.stages.forEach(function (s0) { stage[s0.id] = s0; });
    C.deliverables = C0.deliverables.map(function (d) {
      var s0 = stage[d.stage], due = [];
      if (s0) { if (d.phase !== "Phase 2" && s0.p1) due.push(s0.p1[1]); if (d.phase !== "Phase 1" && s0.p2) due.push(s0.p2[1]); }
      return Object.assign({}, d, { due: due });
    });
    // summary milestones per phase
    C.milestones = C.phases.map(function (ph, i) {
      var key = i ? "p2" : "p1";
      return { name: ph.name, start: ph.start, golive: ph.golive, items: CHR.KEY_STAGES.map(function (k) { var s0 = stage[k[0]]; if (!s0 || !s0[key]) return null;
        return { id: k[0], name: k[2], date: k[0] === "S01" && !i && K.kickoff != null ? K.kickoff : s0[key][k[1]], end: s0[key][1] }; }).filter(Boolean) };
    });
    // budget from Billing (amounts if known, otherwise % structure)
    var fees = {}, order = [];
    M.billing.filter(function (b) { return b.fee; }).forEach(function (b) {
      if (!fees[b.fee]) { fees[b.fee] = { fee: b.fee, amount: 0, inst: [] }; order.push(b.fee); }
      fees[b.fee].amount += b.amount || 0; fees[b.fee].inst.push({ n: b.inst, pct: b.pct, trigger: b.msName, cond: b.cond, date: b.msEnd });
    });
    C.fees = order.map(function (f) { return fees[f]; });
    var billed = C.fees.reduce(function (a, f) { return a + f.amount; }, 0);
    C.total = C0.budget || billed || 0; C.currency = P.currency || "THB";
    C.reserve = C.total ? C.total * C.contingency : 0;
    // stakeholders: sheet, else grouped from the Kickoff team by role + side
    if (C0.stakeholders.length) C.stakeholders = C0.stakeholders;
    else {
      var g = {}, go = [];
      team.forEach(function (t) { var org = t.side === "HMC" ? "HMC" : "Client", k = t.role + "|" + org;
        if (!g[k]) { var m = CHR.ROLE_MAP[t.role] || ["Medium", "Medium"]; g[k] = { name: t.role, org: org, role: t.role, infl: m[0], int: m[1], n: 0, people: [] }; go.push(k); }
        g[k].n++; g[k].people.push(t.name); });
      C.stakeholders = go.map(function (k) { return g[k]; }); C.stakeAuto = true;
    }
    var hi = function (v) { return /^h/i.test(v); };
    C.quads = [[], [], [], []];   // 0 keep satisfied (TL), 1 manage closely (TR), 2 monitor (BL), 3 keep informed (BR)
    C.stakeholders.forEach(function (s0) { var top = hi(s0.infl), right = hi(s0.int); C.quads[top ? (right ? 1 : 0) : (right ? 3 : 2)].push(s0); });
    // risks: sheet, else the standard top 5 from the Kick-off risk register
    var PL = { Low: 1, Medium: 2, High: 3 };
    C.risks = (C0.risks.length ? C0.risks : KO.RISKS.slice(0, 5).map(function (r) { return { text: r[0], prob: r[2], impact: r[3], resp: r[1], owner: "PMs" }; }))
      .map(function (r) { return Object.assign({ score: (PL[r.prob] || 2) * (PL[r.impact] || 2) }, r); });
    C.riskAuto = !C0.risks.length;
    C.approvers = C0.approvers.length ? C0.approvers : [
      { name: C.sponsorC, title: "Project Sponsor", org: C.client }, { name: C.sponsorH, title: "Project Sponsor", org: C.vendor },
      { name: C.pmC, title: "Project Manager", org: C.client }, { name: C.pmH, title: "Project Manager", org: C.vendor }];
    C.weekly = K ? K.weekly : ""; C.steering = K ? K.steering : "";
    C.model = P.model || ""; C.name = P.name || "Project";
    return C;
  }

  // ---------- Kick-off preview (HTML) – slide-by-slide mirror of the PowerPoint deck
  function renderKickoff(M, assets) {
    var K = M.kickoff, P = M.P;
    if (!K) return '<div class="psr"><section class="page">' + header(M, "external", "Project Kick-off") +
      '<div class="rat"><div>ไฟล์นี้ยังไม่มีชีท <b>Kickoff</b> และ <b>Schedule</b> – ใช้ Template V.1 (ฉบับที่มี Kick-off) แล้วกรอก Go-live Date, Duration, Module และทีมงาน</div></div>' + footer(M, "external", 1) + "</section></div>";
    var A = Object.assign({}, assets || (typeof root !== "undefined" && root && root.PSR_KO_ASSETS) || {}, { logoN: BRAND.hn.replace(/^data:/, ""), logoW: BRAND.hw.replace(/^data:/, "") });
    var img = function (k) { return A[k] ? "data:" + A[k] : ""; };
    var client = esc(P.client || "Client"), vendor = esc(P.vendor || "HUMANICA");
    var has2 = K.start2 != null && K.golive2 != null, n = 0, out = [];
    var chrome = function (dark, num) {
      return '<div class="ko-conf' + (dark ? " dk" : "") + '">Confidential</div>' +
        (A[dark ? "logoW" : "logoN"] ? '<img class="ko-logo" src="' + img(dark ? "logoW" : "logoN") + '" alt="">' : '<div class="ko-logo txt' + (dark ? " dk" : "") + '">' + vendor + "</div>") +
        (num ? '<div class="ko-num">' + n + "</div>" : "");
    };
    var push = function (cls, body, style) { n++; out.push('<section class="kos ' + cls + '"' + (style ? ' style="' + style + '"' : "") + ">" + body + "</section>"); };
    var content = function (title, sub, inner, center, extra) {
      push("ko-c" + (center ? " ctr" : ""), '<div class="ko-bar"></div><h2>' + esc(title) + "</h2>" + (sub ? '<div class="ko-sub">' + esc(sub) + "</div>" : "") +
        '<div class="ko-body">' + inner + "</div>" + (extra || "") + chrome(false, true));
    };
    var partN = 0;
    var part = function (title) {
      push("ko-part", '<div class="ko-pn">PART ' + KO.ROMAN[partN++] + "</div><h1>" + esc(title) + "</h1>" + chrome(true), A.divider ? "background-image:url(" + img("divider") + ")" : "");
    };
    var sq = function (i) { return '<span class="ko-sq">' + i + "</span>"; };
    var table = function (head, rows, cls) {
      return '<table class="ko-t ' + (cls || "") + '"><thead><tr>' + head.map(function (x) { return "<th>" + x + "</th>"; }).join("") + "</tr></thead><tbody>" +
        rows.map(function (r) { return "<tr>" + r.join("") + "</tr>"; }).join("") + "</tbody></table>";
    };
    var td = function (v, cls) { return "<td" + (cls ? ' class="' + cls + '"' : "") + ">" + (v == null ? "" : v) + "</td>"; };

    // cover
    push("ko-cover", '<div class="ko-cv"><h1>PROJECT KICK-OFF</h1><div class="ko-cvs">' + esc(P.name || "Implementation Project") + " for " + client + '</div><div class="ko-cvd">' + enDate(K.kickoff) + "</div>" +
      (P.logo && /^data:image\//.test(P.logo) ? '<img class="ko-cl" src="' + P.logo + '" alt="">' : '<div class="ko-cl ph">Client\'s Logo</div>') + "</div>" + chrome(false),
      A.cover ? "background-image:url(" + img("cover") + ")" : "");
    // agenda
    push("ko-c ko-ag", '<div class="ko-bar"></div><h2>MEETING AGENDA</h2><ol class="ko-agl">' + KO.AGENDA.map(function (t, i) { return "<li><b>" + ("0" + (i + 1)).slice(-2) + "</b>" + esc(t) + "</li>"; }).join("") + "</ol>" +
      (A.building ? '<div class="ko-agi" style="background-image:url(' + img("building") + ')"></div>' : "") + chrome(false, true));
    // PART I
    part(KO.PARTS[0]);
    content("THE OBJECTIVES", null, '<ol class="ko-obj"><li>' + sq(1) + "<span>Formal kick-off for <b>" + client + " " + esc(P.name || "") + "</b></span></li>" +
      KO.OBJ.map(function (t, i) { return "<li>" + sq(i + 2) + "<span>" + esc(t) + "</span></li>"; }).join("") + "</ol>", false,
      A.strip ? '<div class="ko-strip" style="background-image:url(' + img("strip") + ')"></div>' : "");
    // PART II
    part(KO.PARTS[1]);
    ["Phase 1", "Phase 2"].forEach(function (ph, pi) {
      var sc = KO.scope(K, ph); if (!sc.all.length) return;
      var card = function (m) { return '<div class="ko-mod"><span class="ko-ic">' + esc(m.name.charAt(0).toUpperCase()) + "</span><div><b>" + esc(m.name.toUpperCase()) + "</b><small>" + esc((m.features || "").replace(/ · /g, "  |  ")) + "</small></div></div>"; };
      var inner;
      if (sc.core.length) {
        var half = Math.ceil(sc.other.length / 2);
        inner = '<div class="ko-scope"><div class="ko-col">' + sc.other.slice(0, half).map(card).join("") + '</div><div class="ko-core"><h3>CORE HR</h3>' +
          sc.core.map(function (m) { return "<div><b>" + esc(m.name.toUpperCase()) + "</b><small>" + esc((m.features || "").replace(/ · /g, "  |  ")) + "</small></div>"; }).join("") +
          '</div><div class="ko-col">' + sc.other.slice(half).map(card).join("") + "</div></div>";
      } else inner = '<div class="ko-scope3">' + sc.other.map(card).join("") + "</div>";
      content("SCOPE OF WORK", (has2 ? "Phase " + (pi + 1) + " · " : "") + "Go-live " + enDate(pi ? K.golive2 : K.golive1), inner, true);
    });
    var IP = KO.ints(K), DC = { "Inbound": "in", "Outbound": "out", "2-ways": "two" };
    IP.forEach(function (pg, i) {
      if (!pg.length) return;
      content("SYSTEM INTEGRATION", "Interfaces in scope" + (IP.length > 1 ? " (" + (i + 1) + "/" + IP.length + ")" : ""),
        table(["System / Interface", "Direction", "Data", "Phase"], pg.map(function (x) { return [td(esc(x.system), "b"), td(esc(x.dir), "dir " + (DC[x.dir] || "")), td(esc(x.data), "g"), td(esc(x.phase), "c")]; }), "ko-int"), true);
    });
    content("KEY BENEFITS & OUTCOME", null, '<ol class="ko-ben">' + KO.BENEFITS.map(function (t, i) { return "<li>" + sq(i + 1) + "<b>" + esc(t) + "</b></li>"; }).join("") + "</ol>", true);
    // PART III
    part(KO.PARTS[2]);
    var po = KO.isPO(P);
    content("PROJECT METHODOLOGY", po ? "Payroll Outsourcing Model (PO)" : "Payroll Outsourcing & ESS Model / SaaS (PE / SaaS)",
      '<div class="ko-meth">' + KO.method(po).map(function (m, i) { var c = "#" + KO.METHOD_TINT[i];
        return '<div style="--t:' + c + '"><span class="ko-mn">' + (i + 1) + "</span><h4>" + m[0] + "</h4><ul>" + m[1].map(function (b) { return "<li>" + esc(b) + "</li>"; }).join("") + "</ul></div>"; }).join("") + "</div>", true);
    // PART IV
    part(KO.PARTS[3]);
    var OT = KO.orgTiers(K);
    if (OT.some(function (t) { return t.client.length || t.hmc.length; })) {
      var node = function (t, hmc) { return '<div class="ko-on' + (hmc ? " hmc" : "") + '"><span>' + esc(KO.initial(t.name)) + "</span><div><b>" + esc(t.name) + "</b><i>" + esc(t.pos || t.role || "") + "</i></div></div>"; };
      content("PROJECT TEAM", "Project Organization Chart", '<div class="ko-org">' +
        '<div class="ko-orgk"><span class="c">' + client + '</span><span class="h">' + vendor + "</span></div>" +
        OT.map(function (t, i) {
          var n = t.client.length + t.hmc.length;
          return '<div class="ko-tr t' + i + (n > 6 ? " dense" : "") + '"><div class="ko-tl"><em>' + (i + 1) + "</em>" + tr(t.label) + '</div><div class="ko-tn">' +
            (n ? t.client.map(function (x) { return node(x, 0); }).join("") + (t.client.length && t.hmc.length ? '<i class="ko-sep"></i>' : "") + t.hmc.map(function (x) { return node(x, 1); }).join("")
               : '<div class="ko-on tbd"><div><b>' + (LANG === "th" ? "รอระบุ" : "To be assigned") + "</b></div></div>") + "</div></div>";
        }).join("") + "</div>", true);
    }
    content("GOVERNANCE STRUCTURE", "Project Governance & Reporting", '<div class="ko-gov"><div class="ko-tri"><div class="ko-trik">ESCALATION TIER</div><div class="ko-trig"></div>' +
      KO.GOV_TIERS.map(function (t, i) { return '<div class="ko-tier t' + i + '"><em>' + t[0] + "</em><b>" + esc(t[1]) + "</b><small>" + esc(t[2]).replace(/\n/g, "<br>") + "</small></div>"; }).join("") +
      '</div><div class="ko-govr"><p>To ensure successful delivery of the project implementation, ' + client + " and " + vendor + " need to work closely together as a united team.</p>" +
      [["PROJECT TEAM WEEKLY STATUS UPDATE MEETING", K.weekly || "–"], ["MONTHLY STEERING COMMITTEE", K.steering || "–"]].map(function (m) { return "<h5>" + m[0] + "</h5><div>◷ " + esc(m[1]) + "</div>"; }).join("") +
      '<div class="ko-gb">' + KO.GOV_BOX.map(function (b) { return "<div><b>" + b[0] + "</b><ul>" + b[1].map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></div>"; }).join("") + "</div></div></div>");
    // PART V
    part(KO.PARTS[4]);
    [["p1", K.start1, K.golive1, "Phase 1"], ["p2", K.start2, K.golive2, "Phase 2"]].forEach(function (ph) {
      if (ph[1] == null) return;
      var T = KO.timeline(K, ph[0]); if (!T) return;
      var X = function (v) { return ((v - T.start) / (T.end - T.start) * 100).toFixed(3) + "%"; };
      var head = '<div class="ko-gr hd"><div>Phase</div><div>Start Date</div><div>End Date</div><div>Owner</div><div>% Done</div><div>Status</div><div class="ko-gg">' +
        T.cols.map(function (c, i) { var nx = i < T.cols.length - 1 ? T.cols[i + 1] : T.end; return '<span style="left:' + X(c) + ";width:" + ((nx - c) / (T.end - T.start) * 100).toFixed(3) + '%">' + T.label(c) + "</span>"; }).join("") + "</div></div>";
      var grid = T.cols.slice(1).map(function (c) { return '<i style="left:' + X(c) + '"></i>'; }).join("");
      var kx = ph[0] === "p1" && K.kickoff != null && K.kickoff >= T.start && K.kickoff <= T.end ? X(K.kickoff) : null;
      var rows = T.st.map(function (x) { var a = x[ph[0]][0], b = x[ph[0]][1];
        return '<div class="ko-gr' + (x.id === "S13" ? " gl" : "") + '"><div>' + esc(stageName(x)) + "</div><div>" + dShort(a) + "</div><div>" + dShort(b) + "</div><div>" + (KO.OWN[x.id] || "Joint") + '</div><div>0%</div><div class="op">OPEN</div><div class="ko-gg">' + grid +
          (a === b ? '<span class="dia" style="left:' + X(a + DAY / 2) + '"></span>' : '<span class="bar' + (x.id === "S14" ? " hc" : "") + '" style="left:' + X(a) + ";width:" + ((b + DAY - a) / (T.end - T.start) * 100).toFixed(3) + '%"></span>') +
          (kx ? '<span class="kx" style="left:' + kx + '"></span>' : "") + "</div></div>"; }).join("");
      content("OVERALL PROJECT TIMELINE", (has2 ? ph[3] + " · " : "") + enDate(ph[1]) + " → Go-live " + enDate(ph[2]),
        '<div class="ko-gantt">' + head + rows + (kx ? '<div class="ko-gr ft"><div></div><div></div><div></div><div></div><div></div><div></div><div class="ko-gg"><b style="left:' + kx + '">Kick-off</b></div></div>' : "") + "</div>");
    });
    var B = M.billing.filter(function (b) { return b.fee; });
    if (B.length) content("PAYMENT MILESTONES", "Installments and target dates follow the project milestones",
      table(["Fee", "Installment", "%", "Condition / Trigger Milestone", "Target Date"], B.map(function (b) {
        return [td(esc(b.fee), "b"), td(esc(b.inst), "c"), td(fmtP(b.pct), "c pct"), td(esc(b.cond || b.msName)), td(b.msEnd != null ? enDate(b.msEnd) : "–", "c nowrap")]; }), "ko-pay"), true);
    // PART VI
    part(KO.PARTS[5]);
    content("KEY SUCCESS FACTORS", null, '<div class="ko-ksf">' + (A.ksf ? '<div class="ko-ksfi" style="background-image:url(' + img("ksf") + ')"></div>' : "") +
      '<ol class="ko-obj">' + KO.KSF.map(function (t, i) { return "<li>" + sq(i + 1) + "<span>" + esc(t) + "</span></li>"; }).join("") + "</ol></div>");
    // PART VII
    part(KO.PARTS[6]);
    var CAL = KO.calendar(K);
    if (CAL) {
      var cells = "";
      for (var c0 = 0; c0 < CAL.weeks * 7; c0++) {
        var di = c0 % 7, day = c0 - CAL.dow0 + 1, inM = day >= 1 && day <= CAL.days, e = inM ? CAL.ev[String(CAL.m0 + (day - 1) * DAY)] : null;
        cells += '<div class="' + (di > 4 ? "we" : "") + (inM ? "" : " out") + '">' + (inM ? "<em>" + day + "</em>" : "") +
          (e ? e.slice(0, 3).map(function (o) { return '<span class="' + o.k + '">' + esc(o.t) + "</span>"; }).join("") : "") + "</div>";
      }
      content("KEY UPCOMING ACTIVITIES", CAL.title, '<div class="ko-cal" style="grid-template-rows:auto repeat(' + CAL.weeks + ',1fr)">' +
        ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(function (d, i) { return '<div class="h' + (i > 4 ? " we" : "") + '">' + d + "</div>"; }).join("") + cells + "</div>");
      var NS = KO.nextSteps(K), nr = NS.map(function (x, i) { return [td(i + 1, "c"), td(esc(stageName(x)), "b"), td(KO.OWN[x.id] || "Joint", "c"), td(dShort(x.p1[1]), "c nowrap"), td(esc(KO.DEL[x.id] || ""), "g"), td("")]; });
      for (var k = NS.length; k < 10; k++) nr.push([td(k + 1, "c"), td(""), td(""), td(""), td(""), td("")]);
      content("NEXT STEPS / ACTIONS", "First 6 weeks after kick-off", table(["#", "Next Steps / Actions", "Owner", "Due Date", "Expected Deliverables", "Remarks"], nr, "ko-ns"));
    }
    // Appendix
    push("ko-part", "<h1>APPENDIX</h1>" + chrome(true), A.divider ? "background-image:url(" + img("divider") + ")" : "");
    content("RISK MANAGEMENT", null, table(["#", "Risks", "Plan", "Probability", "Impact", "Risk Impact"], KO.RISKS.map(function (r0, i) {
      return [td(i + 1, "c"), td(esc(r0[0])), td(esc(r0[1]), "g"), td(r0[2], "c b lv " + r0[2]), td(r0[3], "c b lv " + r0[3]), td(esc(r0[4]), "sm")]; }), "ko-risk"));
    content("ROLE & RESPONSIBILITIES", null, '<div class="ko-rr">' + (A.rr ? '<div class="ko-rri" style="background-image:url(' + img("rr") + ')"></div>' : "") +
      "<div>" + KO.RR.map(function (r0) { return "<h5>" + r0[0] + "</h5><p>" + esc(r0[1]) + "</p>"; }).join("") + "</div></div>");
    content("PROJECT REPORTING", null, table(["Document List", "Objectives", "Timeline"], KO.DOCS.map(function (d) { return [td(esc(d[0]), "b"), td(esc(d[1]), "g"), td(esc(d[2]), "c")]; }), "ko-doc"), true);
    content("SYSTEM REQUIREMENTS", null, table(["Items", "Information"], KO.SYSREQ.map(function (d) { return [td(esc(d[0]), "b"), td(esc(d[1]))]; }), "ko-sys"), true);
    push("ko-end", "<h1>THANK YOU</h1><p>If you have any questions, please feel free to ask!</p>" + chrome(false), A.thanks ? "background-image:url(" + img("thanks") + ")" : "");
    return '<div class="psr kod">' + out.join("") + "</div>";
  }

  // ---------- Steering Committee model (shared by HTML + PPT)
  var SEV = { "Delayed": 3, "At Risk": 2, "On Track": 1, "Completed": 0, "Not Started": 0 };
  function steeringModel(M, mode) {
    var P = M.P, rd = M.rd, K = M.kickoff;
    var open = M.issues.filter(function (i) { return i.open && (mode === "internal" || i.vis !== "Internal"); });
    var worst = function (arr) { var w = "On Track"; arr.forEach(function (x) { if ((SEV[x] || 0) > (SEV[w] || 0)) w = x; }); return w; };
    var dimIss = function (L) { return open.filter(function (i) { return String(i.impact || "").toUpperCase().split(/[^A-Z]/).indexOf(L) >= 0; }); };
    var delayedMs = M.milestones.filter(function (m) { return m.key && m.status === "Delayed"; });
    var bill = M.billing.filter(function (b) { return b.fee; });
    var billSt = bill.some(function (b) { return b.status === "Overdue"; }) ? "Delayed" : bill.some(function (b) { return b.status === "Milestone Delayed"; }) ? "At Risk" : "On Track";
    var dims = [
      { k: "SCHEDULE", s: P.overallStatus === "Completed" ? "On Track" : P.overallStatus, d: delayedMs.length ? delayedMs.length + " key milestone(s) overdue" : "Key milestones on plan", n: dimIss("T").length },
      { k: "SCOPE", s: worst(dimIss("S").map(function (i) { return i.rag; })), d: dimIss("S").length ? dimIss("S").length + " open scope item(s)" : "No open scope item", n: dimIss("S").length },
      { k: "BUDGET", s: worst([billSt].concat(dimIss("C").map(function (i) { return i.rag; }))), d: billSt === "Delayed" ? "Overdue payment" : billSt === "At Risk" ? "Payment milestone delayed" : "Payments on plan", n: dimIss("C").length },
      { k: "QUALITY", s: worst(dimIss("Q").map(function (i) { return i.rag; })), d: dimIss("Q").length ? dimIss("Q").length + " open quality item(s)" : "No open quality item", n: dimIss("Q").length }
    ];
    var items = steerItems(M, mode);
    var top = open.filter(function (i) { return i.steer !== "Decision"; }).sort(function (a, b) { return (SEV[b.rag] || 0) - (SEV[a.rag] || 0) || ((a.due == null ? 9e15 : a.due) - (b.due == null ? 9e15 : b.due)); });
    var keyMs = M.milestones.filter(function (m) { return m.key; });
    // payments vs plan (by milestone dates): planned = trigger milestone due on/before report date
    var fees = {}, order = [];
    bill.forEach(function (b) { if (!fees[b.fee]) { fees[b.fee] = { fee: b.fee, value: M.fees[b.fee] || 0, plan: 0, inv: 0, paid: 0, n: 0, inst: [] }; order.push(b.fee); }
      var f = fees[b.fee], due = b.msEnd != null && b.msEnd <= rd; f.n++; f.inst.push(b);
      if (due) f.plan += b.pct; if (b.status === "Invoiced" || b.status === "Paid" || b.status === "Overdue") f.inv += b.pct; if (b.status === "Paid") f.paid += b.pct; });
    var golive = P.goLive != null ? P.goLive : (K ? K.golive1 : null);
    var horizon = rd + 30 * DAY;
    var next = M.milestones.filter(function (m) { return m.key && m.status !== "Completed" && m.end != null && m.end >= rd && m.end <= rd + 45 * DAY; }).sort(function (a, b) { return a.end - b.end; });
    var acts = M.activities.filter(function (a) { return a.status !== "Done" && a.status !== "N/A" && a.end != null && a.start != null && a.start <= horizon && a.end >= rd; })
      .sort(function (a, b) { return a.end - b.end; });
    return { P: P, rd: rd, dims: dims, decisions: items.filter(function (i) { return i.steer === "Decision"; }), acks: items.filter(function (i) { return i.steer === "Acknowledge"; }),
      top: top.slice(0, 6), openN: open.length, keyMs: keyMs, delayedMs: delayedMs, fees: order.map(function (f) { return fees[f]; }), hasBill: bill.length > 0,
      golive: golive, days: golive != null ? Math.round((golive - rd) / DAY) : null, next: next, acts: acts.slice(0, 8), steering: K ? K.steering : "",
      phases: M.phases.filter(function (p) { return p.status !== "N/A"; }) };
  }

  // ---------- Steering Committee deck (HTML) – 16:9, mirrors buildSteering() in pptx-export.js
  var ST_COL = { "Completed": "#2f6fde", "On Track": "#2e9e6b", "At Risk": "#e0a100", "Delayed": "#d64545", "Not Started": "#94a3b8" };
  function renderSteering(M, assets, mode) {
    var S = steeringModel(M, mode), P = S.P;
    var A = Object.assign({}, assets || (typeof root !== "undefined" && root && root.PSR_KO_ASSETS) || {}, { logoN: BRAND.hn.replace(/^data:/, ""), logoW: BRAND.hw.replace(/^data:/, "") });
    var img = function (k) { return A[k] ? "data:" + A[k] : ""; };
    var vendor = esc(P.vendor || "HUMANICA"), client = esc(P.client || "Client"), n = 0, out = [];
    var chrome = function (dark, num) { return '<div class="ko-conf' + (dark ? " dk" : "") + '">Confidential</div>' + (A[dark ? "logoW" : "logoN"] ? '<img class="ko-logo" src="' + img(dark ? "logoW" : "logoN") + '" alt="">' : '<div class="ko-logo txt">' + vendor + "</div>") +
      (num ? '<div class="ko-num">' + n + "</div>" : ""); };
    var push = function (cls, body, style) { n++; out.push('<section class="kos ' + cls + '"' + (style ? ' style="' + style + '"' : "") + ">" + body + "</section>"); };
    var slide = function (title, sub, inner, center) { push("ko-c stc" + (center ? " ctr" : ""), '<div class="ko-bar"></div><h2>' + esc(title) + "</h2>" + (sub ? '<div class="ko-sub">' + sub + "</div>" : "") + '<div class="ko-body">' + inner + "</div>" + chrome(false, true)); };
    var pill = function (s0) { return '<span class="st-pill" style="background:' + (ST_COL[s0] || "#94a3b8") + '">' + esc(s0) + "</span>"; };
    var dot = function (s0) { return '<i class="st-dot" style="background:' + (ST_COL[s0] || "#94a3b8") + '"></i>'; };
    var chips = function (imp) { return String(imp || "").split(/[^A-Za-z]+/).filter(Boolean).map(function (x) { return '<span class="st-imp">' + esc(x.toUpperCase()) + "</span>"; }).join(""); };
    var td = function (v, cls) { return "<td" + (cls ? ' class="' + cls + '"' : "") + ">" + (v == null ? "" : v) + "</td>"; };
    var table = function (head, rows, cls) { return '<table class="ko-t ' + (cls || "") + '"><thead><tr>' + head.map(function (x) { return "<th>" + x + "</th>"; }).join("") + "</tr></thead><tbody>" + rows.map(function (r) { return "<tr>" + r.join("") + "</tr>"; }).join("") + "</tbody></table>"; };
    var chunk = function (arr, k) { var n0 = Math.ceil(arr.length / k) || 1, per = Math.ceil(arr.length / n0) || k, o = []; for (var i = 0; i < arr.length; i += per) o.push(arr.slice(i, i + per)); return o.length ? o : [[]]; };

    // 1 cover
    push("ko-cover", '<div class="ko-cv"><h1>STEERING COMMITTEE</h1><div class="ko-cvs">' + esc(P.name || "Project") + " · " + client + '</div><div class="ko-cvd">' + enDate(S.rd) + " · Overall status " + pill(P.overallStatus) + "</div>" +
      (P.logo && /^data:image\//.test(P.logo) ? '<img class="ko-cl" src="' + P.logo + '" alt="">' : '<div class="ko-cl ph">Client\'s Logo</div>') + "</div>" + chrome(false), A.cover ? "background-image:url(" + img("cover") + ")" : "");
    // 2 agenda
    var AG = ["EXECUTIVE DASHBOARD", "DECISIONS NEEDED (" + S.decisions.length + ")", "FOR ACKNOWLEDGEMENT (" + S.acks.length + ")", "KEY MILESTONE STATUS", "TOP RISKS & ISSUES"].concat(M.crs && M.crs.length ? ["CHANGE REQUESTS"] : []).concat(S.hasBill ? ["PAYMENT MILESTONES VS PLAN"] : []).concat(["NEXT 30 DAYS"]);
    push("ko-c ko-ag", '<div class="ko-bar"></div><h2>AGENDA</h2><ol class="ko-agl">' + AG.map(function (t, i) { return "<li><b>" + ("0" + (i + 1)).slice(-2) + "</b>" + esc(t) + "</li>"; }).join("") + "</ol>" +
      (A.building ? '<div class="ko-agi" style="background-image:url(' + img("building") + ')"></div>' : "") + chrome(false, true));
    // 3 dashboard
    var oc = ST_COL[P.overallStatus] || "#94a3b8";
    slide("EXECUTIVE DASHBOARD", "Status as of " + enDate(S.rd) + " · RAG by PMI performance dimension",
      '<div class="st-dash"><div class="st-ov" style="background:' + oc + '"><small>OVERALL STATUS</small><b>' + esc(P.overallStatus) + "</b>" +
      '<div class="st-pg"><span>Progress <b>' + fmtP(P.overall) + "</b></span><span>Plan " + fmtP(P.overallPlanned) + '</span></div><div class="st-bar"><i style="width:' + Math.round(P.overall * 100) + '%"></i><em style="left:' + Math.round(P.overallPlanned * 100) + '%"></em></div>' +
      (S.days != null ? '<div class="st-gl"><b>' + S.days + "</b> days to go-live · " + enDate(S.golive) + "</div>" : "") + "</div>" +
      '<div class="st-dims">' + S.dims.map(function (d) { return '<div class="st-dim" style="border-top-color:' + (ST_COL[d.s] || "#94a3b8") + '"><small>' + d.k + "</small>" + pill(d.s) + "<span>" + esc(d.d) + "</span></div>"; }).join("") + "</div>" +
      '<div class="st-rat"><small>ASSESSMENT</small>' + (P.rationale ? esc(P.rationale) : '<span class="ch-ph">ใส่ Assessment Rationale ในชีท Project</span>') + "</div>" +
      '<div class="st-ph"><small>PHASE PROGRESS · ACTUAL vs PLAN</small>' + S.phases.map(function (p) {
        return '<div class="st-pr"><span>' + esc(p.name) + '</span><div class="st-bar s"><i style="width:' + Math.round(p.pct * 100) + "%;background:" + (ST_COL[p.status] || "#94a3b8") + '"></i><em style="left:' + Math.round((p.planned || 0) * 100) + '%"></em></div><b>' + fmtP(p.pct) + "</b></div>"; }).join("") + "</div></div>");
    // 4 decisions
    chunk(S.decisions, 4).forEach(function (pg, pi, all) {
      slide("DECISIONS NEEDED", "Steering Committee is asked to decide" + (all.length > 1 ? " (" + (pi + 1) + "/" + all.length + ")" : "") + " · tick the resolution in the meeting",
        pg.length ? '<div class="st-decs">' + pg.map(function (i, k) { return '<div class="st-dec"><div class="st-dh"><span class="st-no">D' + (pi * 4 + k + 1) + "</span>" + chips(i.impact) + '<em>' + esc(i.owner || "") + (i.due != null ? " · by " + fmtD(i.due) : "") + "</em></div>" +
          "<b>" + esc(i.text) + '</b><p class="st-ask">' + esc(i.ask || i.action || "") + '</p><div class="st-res"><span>☐ Approved</span><span>☐ Approved with conditions</span><span>☐ Rejected</span><span>☐ Deferred</span></div></div>'; }).join("") + "</div>"
        : '<div class="st-none">No decision needed this period</div>');
    });
    // 5 acknowledgement
    chunk(S.acks, 5).forEach(function (pg, pi, all) {
      slide("FOR ACKNOWLEDGEMENT", "Status and response plans the Steering Committee is asked to note" + (all.length > 1 ? " (" + (pi + 1) + "/" + all.length + ")" : ""),
        pg.length ? '<div class="st-acks">' + pg.map(function (i, k) { return '<div class="st-ack">' + dot(i.rag) + '<span class="st-no a">A' + (pi * 5 + k + 1) + "</span><div><b>" + esc(i.text) + "</b><p>" + esc(i.ask || i.action || "") + '</p></div><div class="st-ow">' + chips(i.impact) + "<em>" + esc(i.owner || "") + "</em></div></div>"; }).join("") + "</div>"
        : '<div class="st-none">Nothing for acknowledgement this period</div>');
    });
    // 6 milestones
    chunk(S.keyMs, 12).forEach(function (pg, pi, all) {
      slide("KEY MILESTONE STATUS", "Actual vs planned % at " + fmtD(S.rd) + (all.length > 1 ? " (" + (pi + 1) + "/" + all.length + ")" : ""),
        table(["Milestone", "Owner", "Target", "Progress (actual ▮ vs plan ┃)", "Status"], pg.map(function (m) {
          return [td(esc(m.name), "b"), td(esc(m.owner || ""), "c"), td(fmtD(m.end), "c nowrap"),
            td('<div class="st-bar s"><i style="width:' + Math.round(m.pct * 100) + "%;background:" + (ST_COL[m.status] || "#94a3b8") + '"></i><em style="left:' + Math.round((m.planned || 0) * 100) + '%"></em></div><span class="st-pc">' + fmtP(m.pct) + " / " + fmtP(m.planned) + "</span>"), td(pill(m.status), "c")]; }), "st-ms"));
    });
    // 7 risks & issues
    slide("TOP RISKS & ISSUES", S.openN + " open items · top " + S.top.length + " by severity · decisions are on their own page",
      table(["", "Type", "Risk / Issue", "Impact", "Response / Mitigation", "Owner · Due"], S.top.map(function (i) {
        return [td(dot(i.rag), "c"), td('<span class="tag">' + esc(i.type) + "</span>"), td(esc(i.text), "b"), td(chips(i.impact), "c"), td(esc(i.action || ""), "g"), td("<b>" + esc(i.owner || "") + "</b><br>" + (i.due != null ? fmtD(i.due) : ""), "c")]; }), "st-ri"));
    // 8a change requests
    var CRm = crModel(M);
    if (CRm && CRm.crs.length) slide("CHANGE REQUESTS", "Register status · Submitted CRs above the PM limit (" + CRm.limit + " MD) need a Steering decision",
      crRegisterHTML(CRm, CRm.crs.filter(function (c) { return CRF.OPEN.indexOf(c.status) >= 0; })));
    // 8 payments vs plan
    if (S.hasBill) slide("PAYMENT MILESTONES VS PLAN", "Planned = installments whose trigger milestone was due by " + fmtD(S.rd),
      '<div class="st-pay">' + S.fees.map(function (f) {
        return '<div class="st-fee"><div class="st-fh"><b>' + esc(f.fee) + "</b>" + (f.value ? "<span>" + Math.round(f.value).toLocaleString("en-US") + " " + esc(P.currency || "") + "</span>" : "") + "</div>" +
          [["Planned", f.plan, "#94a3b8"], ["Invoiced", f.inv, "#2f6fde"], ["Paid", f.paid, "#2e9e6b"]].map(function (r) { return '<div class="st-pr"><span>' + r[0] + '</span><div class="st-bar s"><i style="width:' + Math.round(r[1] * 100) + "%;background:" + r[2] + '"></i></div><b>' + fmtP(r[1]) + "</b></div>"; }).join("") +
          '<div class="st-inst">' + f.inst.map(function (b) { return '<span class="' + (BCLASS[b.status] || "") + '" title="' + esc(b.msName || "") + '">' + esc(b.inst) + " · " + fmtP(b.pct) + " · " + esc(b.status) + "</span>"; }).join("") + "</div></div>"; }).join("") + "</div>");
    // 9 next 30 days
    slide("NEXT 30 DAYS", "Key milestones due in the next 45 days and activities in the next 30 days" + (S.steering ? " · next Steering: " + esc(S.steering) : ""),
      '<div class="st-next"><div><h4 class="ch-h" style="margin-top:0">KEY MILESTONES DUE</h4>' + (S.next.length ? S.next.map(function (m) { return '<div class="st-nm">' + dot(m.status) + "<b>" + esc(m.name) + "</b><span>" + fmtD(m.end) + " · " + fmtP(m.pct) + "</span></div>"; }).join("") : '<div class="st-none s">No key milestone due</div>') +
      '</div><div><h4 class="ch-h" style="margin-top:0">ACTIVITIES IN PROGRESS / STARTING</h4>' + table(["Activity", "Owner", "Due"], S.acts.map(function (a) { return [td(esc(a.name)), td(esc(a.owner || ""), "c " + ownerClass(a.owner)), td(fmtD(a.end), "c nowrap")]; }), "st-ac") + "</div></div>");
    push("ko-end", "<h1>THANK YOU</h1><p>Questions and decisions</p>" + chrome(false), A.thanks ? "background-image:url(" + img("thanks") + ")" : "");
    return '<div class="psr kod">' + out.join("") + "</div>";
  }

  function crRegisterHTML(R, list) {
    var k = R.kpi, cur = esc(R.currency);
    var pill = function (s0) { return '<span class="st-pill" style="background:' + (CRF.STATUS_COL[s0] || "#94a3b8") + '">' + esc(s0) + "</span>"; };
    var money = function (v) { return v == null ? "–" : Math.round(v).toLocaleString("en-US"); };
    var md = function (v) { return v == null ? "–" : String(Math.round(v * 10) / 10); };
    var tiles = [["CHANGE REQUESTS", k.total, k.draft ? k.draft + " draft" : "in register"], ["PENDING APPROVAL", k.pending, md(k.pendMd) + " MD · " + k.steer + " need Steering"],
      ["APPROVED", k.apprN, md(k.apprMd) + " MD · " + money(k.apprCost) + " " + cur], ["CHARGEABLE (APPROVED)", money(k.chargeCost), cur]];
    return '<div class="cr-k">' + tiles.map(function (t, i) { return '<div class="' + (i === 1 && k.steer ? "hot" : "") + '"><small>' + t[0] + "</small><b>" + t[1] + "</b><span>" + t[2] + "</span></div>"; }).join("") + "</div>" +
      (list.length ? '<table class="ko-t cr-t"><thead><tr><th>CR No</th><th>Name of Request</th><th>Status</th><th>Priority</th><th>Service Type</th><th>MD</th><th>Cost (' + cur + ')</th><th>Approval by</th><th>Expected Finish</th><th>Pre-check</th></tr></thead><tbody>' +
        list.map(function (c) { return "<tr><td class=\"b nowrap\">" + esc(c.no) + '</td><td class="b">' + esc(c.name) + '</td><td class="c">' + pill(c.status) + '</td><td class="c' + (c.prio === "Urgent" ? " urg" : "") + '">' + esc(c.prio) +
          '</td><td class="c">' + esc(c.type || "–") + '</td><td class="c">' + md(c.total) + '</td><td class="r">' + money(c.cost) + '</td><td class="c' + (c.level === "Steering Committee" ? " stg" : "") + '">' + esc(c.level || "–") +
          '</td><td class="c nowrap">' + fmtD(c.finish) + '</td><td class="c">' + (c.warnN ? '<span class="cr-w">⚠ ' + c.warnN + "</span>" : '<span class="cr-ok">✓</span>') + "</td></tr>"; }).join("") + "</tbody></table>"
       : '<div class="st-none" style="height:250px">ยังไม่มี CR – เพิ่มแถวในชีท CR</div>');
  }
  // ---------- Change Request pack (HTML) – register + one slide per CR; mirrors buildCR() in pptx-export.js
  function renderCR(M, assets) {
    var R = crModel(M), P = M.P;
    var A = Object.assign({}, assets || (typeof root !== "undefined" && root && root.PSR_KO_ASSETS) || {}, { logoN: BRAND.hn.replace(/^data:/, ""), logoW: BRAND.hw.replace(/^data:/, "") });
    var img = function (k) { return A[k] ? "data:" + A[k] : ""; };
    var vendor = esc(P.vendor || "HUMANICA"), n = 0, out = [];
    var chrome = function () { return '<div class="ko-conf">Confidential</div>' + (A.logoN ? '<img class="ko-logo" src="' + img("logoN") + '" alt="">' : '<div class="ko-logo txt">' + vendor + "</div>") + '<div class="ko-num">' + n + "</div>"; };
    var slide = function (title, sub, inner, cls) { n++; out.push('<section class="kos ko-c stc ' + (cls || "") + '"><div class="ko-bar"></div><h2 title="' + esc(title) + '">' + esc(title) + "</h2>" + (sub ? '<div class="ko-sub">' + sub + "</div>" : "") + '<div class="ko-body">' + inner + "</div>" + chrome() + "</section>"); };
    var pill = function (s0) { return '<span class="st-pill" style="background:' + (CRF.STATUS_COL[s0] || "#94a3b8") + '">' + esc(s0) + "</span>"; };
    var money = function (v) { return v == null ? "–" : Math.round(v).toLocaleString("en-US"); };
    var md = function (v) { return v == null ? "–" : String(Math.round(v * 10) / 10); };
    if (!R) { slide("CHANGE REQUESTS", null, '<div class="st-none">ไฟล์นี้ยังไม่มีชีท <b>&nbsp;CR&nbsp;</b> – ใช้ Template V.1 ฉบับล่าสุด</div>'); return '<div class="psr kod">' + out.join("") + "</div>"; }
    var cur = esc(R.currency);
    slide("CHANGE REQUEST REGISTER", "Sheet CR · approval limit for Project Managers: " + R.limit + " man-days (sheet Charter)", crRegisterHTML(R, R.crs));
    R.crs.forEach(function (c) {
      var mx = Math.max(1, c.md.sa, c.md.dev, c.md.qa, c.md.imp);
      var eff = [["SA/SE", c.md.sa], ["DEV", c.md.dev], ["QA", c.md.qa], ["IMP/OP", c.md.imp]].map(function (e) { return '<div class="cr-e"><span>' + e[0] + '</span><div><i style="width:' + Math.round(e[1] / mx * 100) + '%"></i></div><b>' + md(e[1]) + "</b></div>"; }).join("");
      var ms = CRF.MS.map(function (m0, i) { return '<div class="cr-m' + (c.ms[i] == null ? " na" : "") + '"><span>' + esc(m0.split(" (")[0].split(":")[0]) + "</span><em>" + esc(CRF.PIC[i]) + "</em><b>" + (c.ms[i] != null ? fmtD(c.ms[i]) : "N/A") + "</b></div>"; }).join("");
      var sec = function (h0, v) { return v ? "<h5>" + h0 + "</h5><p>" + esc(v).replace(/\n/g, "<br>") + "</p>" : ""; };
      slide(c.no + " · " + c.name, pill(c.status) + " &nbsp;" + esc(c.prio) + " · " + esc(c.type || "Service type?") + " · requested " + fmtD(c.date) + (c.by ? " by " + esc(c.by) : "") + " · expected finish " + fmtD(c.finish),
        '<div class="cr-g"><div class="cr-d">' + sec("NAME OF REQUEST", c.name) + sec("BACKGROUND", c.bg) + sec("SCOPE OF WORK", c.scope) + sec("IMPLEMENTATION REQUIREMENT", c.req) + sec("RISKS", c.risks) +
        (c.mods.length ? '<h5>IMPACTED MODULES</h5><div class="ch-chips">' + c.mods.map(function (m0) { return '<span title="' + esc(c.det[m0] || "") + '">' + esc(m0) + (c.det[m0] ? " · " + esc(c.det[m0]) : "") + "</span>"; }).join("") + "</div>" : "") +
        '</div><div class="cr-r"><div class="cr-box"><h5>EFFORT &amp; COST</h5>' + eff + '<div class="cr-tot"><span><b>' + md(c.total) + "</b> MD</span><span><b>" + money(c.cost) + "</b> " + cur + "</span></div>" +
        '<div class="cr-lv' + (c.level === "Steering Committee" ? " stg" : "") + '">Approval by ' + esc(c.level || "–") + (c.pay ? " · " + esc(c.pay) : "") + "</div></div>" +
        '<div class="cr-box"><h5>PLAN (PART 3)</h5>' + ms + "</div>" +
        '<div class="cr-box chk"><h5>PM PRE-CHECK</h5>' + c.check.map(function (x0) { return '<div class="cr-c ' + x0.l + '">' + (x0.l === "warn" ? "⚠" : x0.l === "ok" ? "✓" : "ℹ") + " " + esc(x0.t) + "</div>"; }).join("") + "</div></div></div>", "crs");
    });
    return '<div class="psr kod">' + out.join("") + "</div>";
  }

  // ---------- Project Documents hub (HTML) – document register, next-meeting agenda, MOM + RAIDD log, sign-off, BB and training trackers
  var DOC_COL = { Draft: "#94a3b8", Final: "#2f6fde", Signed: "#2e9e6b", Pending: "#94a3b8", "In Review": "#e0a100", "Client Review": "#e0a100", Revised: "#8b5cf6", Submitted: "#e0a100", Rejected: "#d64545", Done: "#2e9e6b", Planned: "#94a3b8", Open: "#e0a100", Closed: "#2e9e6b" };
  function renderDocs(M, assets) {
    var R = docsModel(M), P = M.P, rd = M.rd;
    var A = Object.assign({}, assets || (typeof root !== "undefined" && root && root.PSR_KO_ASSETS) || {}, { logoN: BRAND.hn.replace(/^data:/, "") });
    var vendor = esc(P.vendor || "HUMANICA"), n = 0, out = [];
    var chrome = function () { return '<div class="ko-conf">Confidential</div>' + (A.logoN ? '<img class="ko-logo" src="data:' + A.logoN + '" alt="">' : '<div class="ko-logo txt">' + vendor + "</div>") + '<div class="ko-num">' + n + "</div>"; };
    var slide = function (title, sub, inner) { n++; out.push('<section class="kos ko-c stc dcs"><div class="ko-bar"></div><h2>' + esc(title) + "</h2>" + (sub ? '<div class="ko-sub">' + sub + "</div>" : "") + '<div class="ko-body">' + inner + "</div>" + chrome() + "</section>"); };
    var pill = function (s0) { return '<span class="st-pill" style="background:' + (DOC_COL[s0] || ST_COL[s0] || "#94a3b8") + '">' + esc(s0) + "</span>"; };
    var tbl = function (head, rows, empty) { return rows.length ? '<table class="ko-t dc-t"><thead><tr>' + head.map(function (h0) { return "<th>" + h0 + "</th>"; }).join("") + "</tr></thead><tbody>" +
      rows.map(function (r) { return "<tr>" + r.map(function (c) { return typeof c === "string" ? "<td>" + c + "</td>" : '<td class="' + c[1] + '">' + c[0] + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table>" : '<div class="st-none" style="height:200px">' + empty + "</div>"; };
    var d = function (t) { return t == null ? "–" : dShort(t); };
    var more = function (rows, k) { return rows.length > k ? rows.slice(0, k) : rows; };
    var tiles = function (t) { return '<div class="cr-k">' + t.map(function (x) { return '<div class="' + (x[3] ? "hot" : "") + '"><small>' + x[0] + "</small><b>" + x[1] + "</b><span>" + x[2] + "</span></div>"; }).join("") + "</div>"; };
    if (!M.docs) { slide("PROJECT DOCUMENTS", null, '<div class="st-none">ไฟล์นี้ยังไม่มีชีท <b>&nbsp;Meetings · Sign-off · BB · Training&nbsp;</b> – ใช้ Template V.1 ฉบับล่าสุด</div>'); return '<div class="psr kod">' + out.join("") + "</div>"; }
    // 1 register
    var ico = { ok: ["●", "dc-ok"], none: ["○", "dc-no"], auto: ["◆", "dc-au"], na: ["–", "dc-na"] }, outT = { html: "HTML", word: "Word", ppt: "PPT · HTML · PDF", "": "–" };
    var so = R.signoffs, signed = so.filter(function (x) { return /signed/i.test(x.status); }).length, openI = R.issues.filter(function (i) { return i.open; });
    slide("PROJECT DOCUMENTS", "9 project documents (Methodology) · Job Code " + esc(R.jobCode || "–") + " · as of " + fmtD(rd),
      tiles([["MEETINGS", R.meetings.length, R.meetings.filter(function (m) { return m.status === "Draft"; }).length + " draft MOM"], ["OPEN RAIDD", openI.length, R.agenda.overdue.length + " overdue", R.agenda.overdue.length > 0],
        ["SIGN-OFF", signed + "/" + so.length, "deliverables signed"], ["BUSINESS BLUEPRINT", R.bb.filter(function (b) { return /signed|final/i.test(b.status); }).length + "/" + R.bb.length, "final or signed"]]) +
      tbl(["#", "Document", "", "Status in this project", "Output"], R.docs.map(function (x, i) { var c = ico[x[1]] || ico.na; return [[String(i + 1), "c"], ["<b>" + esc(x[0]) + "</b>", ""], [c[0], "c " + c[1]], esc(x[2]), [outT[x[3]] || "–", "c"]]; }), "") +
      '<div class="dc-note">' + (LANG === "th" ? "SharePoint · <b>01 Internal</b> (ทีมเท่านั้น: รายงาน Internal, Issue Log, ฉบับร่าง) · <b>02 Client Shared</b> (MOM, Status, BB ให้ลูกค้าตรวจ) · <b>03 Signed</b> (PDF ที่ลงนามแล้ว อ่านอย่างเดียว)" : "SharePoint · <b>01 Internal</b> (team only: Internal report, Issue Log, drafts) · <b>02 Client Shared</b> (MOM, Status, BB for review) · <b>03 Signed</b> (PDF with signatures, read-only)") + "</div>");
    // 2 next-meeting agenda
    var ag = R.agenda, li = function (arr, f) { return arr.length ? '<ul class="ch-ul">' + arr.slice(0, 6).map(f).join("") + (arr.length > 6 ? "<li>+" + (arr.length - 6) + " more</li>" : "") + "</ul>" : '<div class="dc-empty">–</div>'; };
    var iLine = function (i) { return "<li><b>" + esc(i.raidd) + "</b> · " + esc(i.text) + (i.owner ? " <em>(" + esc(i.owner) + (i.due != null ? ", " + d(i.due) : "") + ")</em>" : "") + "</li>"; };
    slide("NEXT MEETING AGENDA", "Built from open RAIDD items and milestones in the next 14 days" + (ag.last ? " · last meeting " + esc(ag.last.id) + " " + d(ag.last.date) : ""),
      '<div class="dc-g"><div class="dc-box"><h5>1 · DECISIONS NEEDED (' + ag.decisions.length + ")</h5>" + li(ag.decisions, iLine) + "</div>" +
      '<div class="dc-box hot"><h5>2 · OVERDUE ACTIONS (' + ag.overdue.length + ")</h5>" + li(ag.overdue, iLine) + "</div>" +
      '<div class="dc-box"><h5>3 · DUE IN 14 DAYS (' + ag.soon.length + ")</h5>" + li(ag.soon, iLine) + "</div>" +
      '<div class="dc-box"><h5>4 · KEY MILESTONES IN 14 DAYS (' + ag.ms.length + ")</h5>" + li(ag.ms, function (m) { return "<li><b>" + esc(m.name) + "</b> · " + d(m.end) + " " + pill(m.status) + "</li>"; }) + "</div></div>");
    // 3 meetings + RAIDD
    var byT = {}; R.issues.forEach(function (i) { var k = i.raidd; byT[k] = byT[k] || [0, 0]; byT[k][i.open ? 0 : 1]++; });
    slide("MINUTES OF MEETING & RAIDD LOG", "Sheet Meetings + Issues (RAIDD) · MOM Word form v1.4 per meeting",
      '<div class="dc-raidd">' + ["Risk", "Action", "Issue", "Dependency", "Decision"].map(function (k) { var v = byT[k] || [0, 0]; return "<div><b>" + v[0] + "</b><span>" + k + "</span><em>" + v[1] + " closed</em></div>"; }).join("") + "</div>" +
      tbl(["Meeting ID", "Date", "Type", "Meeting", "Stage", "RAIDD", "Status"], more(R.meetings.slice().sort(function (a, b) { return (b.date || 0) - (a.date || 0); }), 8).map(function (m) {
        return [["<b>" + esc(m.id) + "</b>", "nowrap"], [d(m.date), "c nowrap"], [esc(m.type), "c"], esc(m.name), esc(m.stage), [String(m.raidd.length), "c"], [pill(m.status), "c"]]; }), "ยังไม่มีการประชุม – เพิ่มแถวในชีท Meetings"));
    // 4 sign-off
    slide("DELIVERABLE SIGN-OFF", "Sheet Sign-off · dates from Schedule when blank · Word form v1.3 per deliverable",
      tbl(["No", "Deliverable", "Phase", "Period", "Status", "Signed"], so.map(function (x) { var late = !/signed/i.test(x.status) && x.end != null && x.end < rd;
        return [["<b>" + esc(x.no) + "</b>", "nowrap"], esc(x.name), [esc(x.phase), "c nowrap"], [d(x.start) + " – " + d(x.end), "c nowrap" + (late ? " dc-late" : "")], [pill(x.status), "c"], [d(x.signed), "c nowrap"]]; }), "ยังไม่มีรายการ – เพิ่มแถวในชีท Sign-off"));
    // 5 BB + training
    slide("BUSINESS BLUEPRINT & TRAINING", "Sheet BB (version control: Draft → Client Review → Revised → Final → Signed) · Sheet Training (HRM-FM-005)",
      '<div class="dc-two"><div>' + tbl(["Module", "Phase", "Ver.", "Status", "Appendix", "Client owner", "Target"], R.bb.map(function (b) { var late = !/signed/i.test(b.status) && b.target != null && b.target < rd;
        var ax = b.apx == null ? "–" : Math.round(b.apx * 100) + "%" + (b.apxI && !/^0 \//.test(b.apxI) ? ' <span class="dc-late">⚠</span>' : "");
        return [["<b>" + esc(b.module) + "</b>", ""], [esc(b.phase), "c nowrap"], [esc(b.ver || "–"), "c"], [pill(b.status), "c"], [ax, "c nowrap"], esc(b.co || "–"), [d(b.target), "c nowrap" + (late ? " dc-late" : "")]]; }), "ยังไม่มี BB – เพิ่มแถวในชีท BB") +
      "</div><div>" + tbl(["Session", "Date", "Subject", "Att."], R.training.map(function (t) { return [["<b>" + esc(t.no) + "</b>", "nowrap"], [d(t.date), "c nowrap"], esc(t.subject), [String(t.att.length), "c"]]; }), "ยังไม่มีรอบอบรม") + "</div></div>");
    // 6 BB appendix review (when an appendix workbook was loaded in the Generator / bb_build.js)
    var AXm = typeof PSRAPX !== "undefined" ? PSRAPX : (root && root.PSRAPX);
    if (M.appendix && AXm) slide("BB APPENDIX REVIEW", esc(M.appendix.file || "") + " · " + (LANG === "th" ? "ตรวจ " : "checked ") + fmtD(M.appendix.at || rd), AXm.slideHTML(M.appendix, esc));
    return '<div class="psr kod">' + out.join("") + "</div>";
  }

  // ---------- Project Charter (HTML) – 16:9 slides, same look as the Kick-off deck; mirrors buildCharter() in pptx-export.js
  function renderCharter(M, assets) {
    var C = charterModel(M), P = M.P;
    if (!C) return '<div class="psr"><section class="page">' + header(M, "external", "Project Charter") +
      '<div class="rat"><div>ไฟล์นี้ยังไม่มีชีท <b>Charter</b> – ใช้ Template V.1 ฉบับล่าสุด (มีชีท Charter) แล้วกรอก Business Case, Objectives และผู้อนุมัติ</div></div>' + footer(M, "external", 1) + "</section></div>";
    var A = Object.assign({}, assets || (typeof root !== "undefined" && root && root.PSR_KO_ASSETS) || {}, { logoN: BRAND.hn.replace(/^data:/, ""), logoW: BRAND.hw.replace(/^data:/, "") });
    var img = function (k) { return A[k] ? "data:" + A[k] : ""; };
    var client = esc(C.client), vendor = esc(C.vendor), n = 0, out = [];
    var chrome = function (num) { return '<div class="ko-conf">Confidential</div>' + (A.logoN ? '<img class="ko-logo" src="' + img("logoN") + '" alt="">' : '<div class="ko-logo txt">' + vendor + "</div>") +
      (num ? '<div class="ko-num">' + n + "</div>" : ""); };
    var push = function (cls, body, style) { n++; out.push('<section class="kos ' + cls + '"' + (style ? ' style="' + style + '"' : "") + ">" + body + "</section>"); };
    var slide = function (title, sub, inner, center) { push("ko-c ch" + (center ? " ctr" : ""), '<div class="ko-bar"></div><h2>' + esc(title) + "</h2>" + (sub ? '<div class="ko-sub">' + sub + "</div>" : "") + '<div class="ko-body">' + inner + "</div>" + chrome(true)); };
    var table = function (head, rows, cls) { return '<table class="ko-t ' + (cls || "") + '"><thead><tr>' + head.map(function (x) { return "<th>" + x + "</th>"; }).join("") + "</tr></thead><tbody>" + rows.map(function (r) { return "<tr>" + r.join("") + "</tr>"; }).join("") + "</tbody></table>"; };
    var td = function (v, cls) { return "<td" + (cls ? ' class="' + cls + '"' : "") + ">" + (v == null ? "" : v) + "</td>"; };
    var ul = function (arr, cls) { return '<ul class="' + (cls || "ch-ul") + '">' + arr.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul>"; };
    var money = function (v) { return Math.round(v).toLocaleString("en-US"); };
    var stCls = /approved/i.test(C.status) ? "ok" : /approval/i.test(C.status) ? "fa" : "dr";
    var ph = function (t) { return '<span class="ch-ph">' + t + "</span>"; };
    var dues = function (d) { return d.due.length ? d.due.map(dShort).join(" / ") : "–"; };
    var dot = function (v) { return '<i class="ch-lv ' + esc(v) + '"></i>'; };
    var orgCls = function (o) { return /hmc|human/i.test(o) ? "h" : /third/i.test(o) ? "t" : "c"; };

    // 1 cover
    push("ko-cover", '<div class="ko-cv"><h1>PROJECT CHARTER</h1><div class="ko-cvs">' + esc(C.name) + " for " + client + '</div><div class="ko-cvd">Version ' + esc(C.version) + " · " + enDate(C.date) +
      ' <span class="ch-st ' + stCls + '">' + esc(C.status) + "</span></div>" +
      (P.logo && /^data:image\//.test(P.logo) ? '<img class="ko-cl" src="' + P.logo + '" alt="">' : '<div class="ko-cl ph">Client\'s Logo</div>') + "</div>" + chrome(false), A.cover ? "background-image:url(" + img("cover") + ")" : "");

    // 2 canvas
    var tile = function (k, t, body, cls) { return '<div class="ch-tile ' + (cls || "") + '"><div class="ch-k"><b>' + k + "</b>" + t + "</div>" + body + "</div>"; };
    var inScope = C.phases.map(function (p) { return "<b>" + p.name + ":</b> " + esc(p.modules.map(function (m) { return m.name; }).join(", ") || "–"); }).concat(C.intsAll.length ? ["<b>Interfaces:</b> " + C.intsAll.length + " systems"] : []);
    var ms = C.milestones.map(function (m) { return "<b>" + m.name + ":</b> " + m.items.filter(function (x) { return /Kick|Go-live/.test(x.name); }).map(function (x) { return esc(x.name) + " " + dShort(x.date); }).join(" → "); });
    var budget = (C.total ? "<b>" + money(C.total) + " " + esc(C.currency) + "</b> + reserve " + fmtP(C.contingency) : "As per contract · reserve " + fmtP(C.contingency)) +
      ul(C.fees.map(function (f) { return esc(f.fee) + " – " + f.inst.length + " installments"; }));
    var people = ul(["<b>Sponsors:</b> " + esc(C.sponsorC || "–") + " · " + esc(C.sponsorH || "–"), "<b>PMs:</b> " + esc(C.pmC || "–") + " · " + esc(C.pmH || "–"),
      "<b>Team:</b> " + (M.kickoff ? M.kickoff.team.filter(function (t) { return t.name && t.side !== "HMC"; }).length + " " + client + " · " + M.kickoff.team.filter(function (t) { return t.name && t.side === "HMC"; }).length + " " + vendor : "–")]);
    slide("PROJECT CHARTER CANVAS", "One-page summary for Sponsor approval · Version " + esc(C.version) + ' · <span class="ch-st ' + stCls + '">' + esc(C.status) + "</span>",
      '<div class="ch-canvas">' +
      tile("WHY", "Business case", '<div class="ch-clamp">' + (C.businessCase ? esc(C.businessCase) : esc(C.purpose)) + "</div>", "why") +
      tile("WHAT", "SMART objectives", ul(C.objectives.slice(0, 5).map(function (o) { return esc(o.text) + (o.target ? ' <em>→ ' + esc(o.target) + "</em>" : ""); })), "what w2") +
      tile("DONE", "Success criteria", ul(C.success.slice(0, 5).map(function (o) { return esc(o.text); })), "done") +
      tile("IN", "In scope", ul(inScope), "in") + tile("OUT", "Out of scope", ul(C.outScope.slice(0, 5).map(esc)), "out") +
      tile("DELIVER", "Key deliverables", ul(C.deliverables.slice(0, 6).map(function (d) { return esc(d.text); })), "del") + tile("WHEN", "Key milestones", ul(ms), "when") +
      tile("COST", "Budget", budget, "cost") + tile("WHO", "Sponsors & team", people, "who") +
      tile("RISK", "Top risks", ul(C.risks.slice().sort(function (a, b) { return b.score - a.score; }).slice(0, 3).map(function (r) { return dot(r.prob) + dot(r.impact) + esc(r.text); })), "risk") +
      tile("IF", "Assumptions & constraints", ul(C.assumptions.slice(0, 2).map(function (x) { return "A · " + esc(x); }).concat(C.constraints.slice(0, 2).map(function (x) { return "C · " + esc(x); }))), "ifc") +
      '<div class="ch-sign">' + C.approvers.slice(0, 4).map(function (a) { return "<div><i></i><b>" + esc(a.name || "…………………") + "</b><span>" + esc(a.title) + " · " + esc(a.org) + "</span></div>"; }).join("") + "</div></div>");

    // 3 business case & purpose
    slide("BUSINESS CASE & PURPOSE", "Why we are doing this project and what success looks like",
      '<div class="ch-2"><div><div class="ch-quote"><small>PROJECT PURPOSE / VISION</small>' + esc(C.purpose) + (C.purposeAuto ? ph("ร่างอัตโนมัติ – แก้ได้ที่ชีท Charter") : "") + "</div>" +
      '<h4 class="ch-h">BUSINESS CASE / PROBLEM STATEMENT</h4><p class="ch-p">' + (C.businessCase ? esc(C.businessCase) : ph("กรอก Business Case ในชีท Charter: ปัญหาเดิม · โอกาส · ผลกระทบถ้าไม่ทำ")) + "</p></div>" +
      '<div><h4 class="ch-h">EXPECTED BENEFITS</h4><div class="ch-ben">' + KO.BENEFITS.slice(0, 8).map(function (b, i) { return '<div><span class="ko-sq">' + (i + 1) + "</span>" + esc(b) + "</div>"; }).join("") + "</div></div></div>");

    // 4 objectives & success criteria
    slide("OBJECTIVES & SUCCESS CRITERIA", 'Objectives are <b class="ch-smart"><i>S</i>pecific <i>M</i>easurable <i>A</i>chievable <i>R</i>elevant <i>T</i>ime-bound</b>',
      table(["#", "Objective", "KPI / Measure", "Target", "Owner"], C.objectives.map(function (o, i) { return [td(i + 1, "c"), td(esc(o.text), "b"), td(esc(o.kpi), "g"), td(esc(o.target), "tg"), td(esc(o.owner), "c")]; }), "ch-obj") +
      '<h4 class="ch-h" style="margin-top:14px">SUCCESS CRITERIA (PROJECT ACCEPTANCE)</h4>' +
      table(["✓", "Success criterion", "Evidence / Measure", "Accepted by"], C.success.map(function (o) { return [td("✓", "c ok"), td(esc(o.text), "b"), td(esc(o.measure), "g"), td(esc(o.by), "c")]; }), "ch-suc"));

    // 5 scope
    slide("SCOPE STATEMENT", "What is in and out · anything outside goes through Change Request",
      '<div class="ch-scope"><div class="ch-in"><h4>✓ IN SCOPE</h4>' + C.phases.map(function (p) {
        return '<div class="ch-ph1"><b>' + p.name + "</b> <small>Go-live " + enDate(p.golive) + '</small><div class="ch-chips">' + p.modules.map(function (m) { return "<span>" + esc(m.name) + "</span>"; }).join("") + "</div>" +
          (p.ints.length ? '<div class="ch-int">Interfaces: ' + esc(p.ints.map(function (x) { return x.system; }).join(" · ")) + "</div>" : "") + "</div>"; }).join("") +
      '</div><div class="ch-out"><h4>✕ OUT OF SCOPE</h4>' + ul(C.outScope.map(esc), "ch-x") + "</div></div>");

    // 6 deliverables
    slide("DELIVERABLES & ACCEPTANCE", "Due dates follow the Schedule stage linked in sheet Charter",
      table(["#", "Deliverable", "Phase", "Accepted by", "Due (Phase 1 / Phase 2)"], C.deliverables.map(function (d, i) { return [td(i + 1, "c"), td(esc(d.text), "b"), td(esc(d.phase), "c"), td(esc(d.by), "c"), td(dues(d), "c nowrap")]; }), "ch-del"), true);

    // 7 milestones
    slide("SUMMARY MILESTONE SCHEDULE", "Calculated from Go-live − duration (sheet Kickoff / Schedule)", '<div class="ch-mls">' + (C.milestones.length ? "" : ph("ใส่ Go-live Date และ Duration ในชีท Kickoff แล้ววันที่ทุก Milestone จะคำนวณให้อัตโนมัติ")) + C.milestones.map(function (m) {
      var t0 = m.start, t1 = Math.max.apply(null, m.items.map(function (x) { return x.date; }).concat([m.golive]));
      var X = function (t) { return (4 + (t - t0) / (t1 - t0) * 92).toFixed(2) + "%"; };
      return '<div class="ch-ml"><div class="ch-mlh"><b>' + m.name + "</b> " + enDate(m.start) + " → Go-live " + enDate(m.golive) + '</div><div class="ch-line"><i></i>' +
        m.items.map(function (x, i) { return '<div class="ch-pt' + (i % 2 ? " dn" : "") + (/Go-live/.test(x.name) ? " gl" : "") + '" style="left:' + X(x.date) + '"><span></span><b>' + esc(x.name) + "</b><em>" + enDate(x.date) + "</em></div>"; }).join("") + "</div></div>";
    }).join("") + "</div>");

    // 8 budget
    var bRows = []; C.fees.forEach(function (f) { f.inst.forEach(function (x, i) { bRows.push([td(i ? "" : esc(f.fee), "b"), td(x.n, "c"), td(fmtP(x.pct), "c pct"), td(esc(x.trigger || x.cond || "")), td(x.date != null ? enDate(x.date) : "–", "c nowrap"),
      td(f.amount ? money(f.amount * x.pct) : "–", "r")]); }); });
    slide("BUDGET SUMMARY", "Payment installments are triggered by project milestones (sheet Billing)",
      '<div class="ch-bud"><div class="ch-bk"><div class="ch-big"><small>TOTAL BUDGET</small>' + (C.total ? money(C.total) + " <em>" + esc(C.currency) + "</em>" : "As per contract") + "</div>" +
      '<div class="ch-big s"><small>CONTINGENCY RESERVE</small>' + fmtP(C.contingency) + (C.reserve ? " · " + money(C.reserve) + " " + esc(C.currency) : "") + "</div>" +
      '<div class="ch-big s"><small>INSTALLMENTS</small>' + bRows.length + " across " + C.fees.length + " fee types</div>" +
      '<p class="ch-note">Use of contingency is reported to the Steering Committee · new scope is costed through Change Request</p></div>' +
      table(["Fee", "#", "%", "Trigger milestone", "Target date", "Amount"], bRows, "ch-bt") + "</div>");

    // 9 stakeholders
    slide("STAKEHOLDER MAP", "Power / interest grid · engagement strategy per quadrant" + (C.stakeAuto ? " · grouped from the project team (sheet Kickoff)" : ""),
      '<div class="ch-pi"><div class="ch-ax y">INFLUENCE →</div><div class="ch-ax x">INTEREST →</div>' + CHR.QUAD.map(function (q, i) {
        var list = C.quads[i];
        return '<div class="ch-q ' + q[2] + '"><h5>' + q[0] + "</h5><small>" + q[1] + '</small><div class="ch-chips">' + list.slice(0, 10).map(function (s0) {
          return '<span class="' + orgCls(s0.org) + '">' + esc(s0.name) + (s0.n ? " ×" + s0.n : "") + ' <em>' + esc(s0.org === "Client" ? (P.short || "Client") : s0.org) + "</em></span>"; }).join("") +
          (list.length > 10 ? "<span>+" + (list.length - 10) + "</span>" : "") + "</div></div>"; }).join("") + "</div>");

    // 10 RACI
    slide("RACI MATRIX", "Who is Responsible · Accountable · Consulted · Informed", table(["Activity / Deliverable"].concat(CHR.RACI_ROLES), CHR.RACI.map(function (r) {
      return [td(r[0], "b")].concat(r.slice(1).map(function (v) { return td(v, "c rc " + v); })); }), "ch-raci") +
      '<div class="ch-rk">' + CHR.RACI_KEY.map(function (k) { return '<span><i class="rc ' + k[0] + '">' + k[0] + "</i><b>" + k[1] + "</b> " + k[2] + "</span>"; }).join("") + "</div>", true);

    // 11 risks, assumptions, constraints
    slide("RISKS · ASSUMPTIONS · CONSTRAINTS", "High-level risks at initiation" + (C.riskAuto ? " (standard register – add project-specific risks in sheet Charter)" : ""),
      '<div class="ch-rac"><div>' + table(["Risk", "P", "I", "Response", "Owner"], C.risks.slice(0, 6).map(function (r) {
        return [td(esc(r.text)), td(esc(r.prob.charAt(0)), "c b lv " + esc(r.prob)), td(esc(r.impact.charAt(0)), "c b lv " + esc(r.impact)), td(esc(r.resp), "g"), td(esc(r.owner), "c")]; }), "ch-risk") +
      '</div><div><h4 class="ch-h">ASSUMPTIONS</h4>' + ul(C.assumptions.map(esc)) + '<h4 class="ch-h">CONSTRAINTS</h4>' + ul(C.constraints.map(esc)) + "</div></div>");

    // 12 governance & authority
    slide("GOVERNANCE & PM AUTHORITY", "Decision rights, escalation path and change control",
      '<div class="ch-gov"><div><div class="ch-esc">' + [["Project Team", "Day-to-day issues · weekly status", C.weekly], ["Project Managers", "Resolve within " + C.sla + " business days · CR ≤ " + C.crLimit + " man-days", ""],
        ["Sponsors / Steering Committee", "Scope, budget, milestone changes · CR > " + C.crLimit + " man-days", C.steering]].map(function (l, i) {
          return '<div class="l' + i + '"><b>' + esc(l[0]) + "</b><span>" + esc(l[1]) + "</span>" + (l[2] ? "<em>◷ " + esc(l[2]) + "</em>" : "") + "</div>"; }).join('<i>▲ escalate</i>') + "</div></div>" +
      "<div>" + table(["Area", "Project Manager authority"], C.authority.map(function (a) { return [td(esc(a.area), "b"), td(esc(a.level))]; }), "ch-auth") + "</div></div>");

    // 13 approval
    slide("APPROVAL & SIGN-OFF", "Charter version " + esc(C.version) + " · " + enDate(C.date),
      '<p class="ch-auth-p">By signing this charter the sponsors formally authorize the project, commit the resources described above and give the Project Managers the authority stated in Governance &amp; PM Authority.</p>' +
      '<div class="ch-sigs">' + C.approvers.slice(0, 6).map(function (a) { return '<div><small>' + esc(a.org) + "</small><b>" + esc(a.name || "") + "</b><span>" + esc(a.title) + '</span><i>Signature</i><i>Date</i></div>'; }).join("") + "</div>");

    return '<div class="psr kod">' + out.join("") + "</div>";
  }

  function renderReport(M, mode) { return trHTML(renderReport0(M, mode)); }
  var TH_CSS = '<style>.psr[data-lang=th] *{letter-spacing:0!important}</style>';
  function renderReport0(M, mode) {
    if (mode === "kickoff") return renderKickoff(M);
    if (mode === "charter") return renderCharter(M);
    if (mode === "steering") return renderSteering(M);
    if (mode === "cr") return renderCR(M);
    if (mode === "docs") return renderDocs(M);
    mode = mode === "internal" ? "internal" : "external";
    // order: summary · upcoming activities · steering · timeline · progress overview (charts) · key milestones
    var pages = [pageCover, pageSummary, pageCalendar];
    if (steerItems(M, mode).length) pages.push(pageSteering);
    pages.push(pageTimeline);
    if (M.chart) pages.push(pageProgress);
    pages.push(pageMilestones);
    if (mode === "internal") pages.push(pageBilling, pageActivities);
    return '<div class="psr ' + mode + '">' + pages.map(function (f, i) { return f(M, mode, i + 1); }).join("") + "</div>";   // page 1 = cover
  }

  // Poppins (Latin subset, embedded) · Thai falls back to Kanit (Google Fonts when online) → Thonburi / Leelawadee UI
  var FONT_STACK = "'Poppins','Kanit','Thonburi','Leelawadee UI','Sarabun',Tahoma,sans-serif";
  var FONT_LINK = '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600&display=swap" rel="stylesheet">';
  var FONT_FACES = [
    "@font-face{font-family:'Poppins';font-style:normal;font-weight:400;font-display:swap;src:url(data:font/woff;base64,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) format('woff')}",
    "@font-face{font-family:'Poppins';font-style:normal;font-weight:500;font-display:swap;src:url(data:font/woff;base64,d09GRgABAAAAAC3UAAwAAAAARkgABAEGAAAAAAAAAAAAAAAAAAAAAAAAAABHUE9TAAAs3AAAACAAAAAgRHZMdUdTVUIAACz8AAAA1gAAASx6n4NKT1MvMgAAKpwAAABRAAAAYFndgAtjbWFwAAAq8AAAAJ8AAADU0cXxn2dseWYAAAEcAAAksAAAOibd7fRRaGVhZAAAJ9wAAAA2AAAANhqoJGdoaGVhAAAqfAAAACAAAAAkDFQCxGhtdHgAACgUAAACaAAAA9oY9y2RbG9jYQAAJewAAAHwAAAB8HCBgAdtYXhwAAAlzAAAACAAAAAgAXkBJm5hbWUAACuQAAABNQAAAmo67liHcG9zdAAALMgAAAATAAAAIP+4ADJ4nI17CVhbZdbwed9QUugawiWlrOECgZCQkJubEJIQAoGw7/veAm2hlEIodLWFFqu1al3Huo3aOnUZ/XScUVo7ztRRXKqO1VF/O47O/CNfXac6+o/9Wpub73nvvQmBdvyH58nCyb3nnPe855z3bBeQ7wvfalglyQAJgFTGyBS6cyGyH78BQL4J32qYkOhhOYBcJaNlUpVZZVaYFVJFV7GuUNnRpezqTuzuxvqyyw9I1pTwgK7E7i4ADM2+i/AFngYJrACQS2hJRCprNDGGKCoylP7zsq5lSrU6IV6tjsfTXAz6b2++OiFBTV6AIQlXo0RJHEhACiCX0ipGSqsOLK1cxi2tXCaJe+utt94CDAkAEg2ehRjyDUkZipbSZv7FMvyLkfIvSklLGXxbytTdaZvSXk7blHbv0yn3PKXapHpZtUl1LXfx5ZSX0ekne0+cOHGi98ne55577rneJwEkYPM9hhMlKyEZMsAAkBwaKqVoNjWVZaKiFGwmZo0mM8tQUVEKOjVVRcVjCqIUbGgoFWFijakqCidmdTmdnVt2SDTpBfXWLZ3O5o3SHRI1XVCfw92Spc1g3jBkae9otoXW1IT11qoY6V9kdHl+3aawmprFXXUJWWEfrqTL8tGyzOWnFxk1XI8lLU27/A1YBGrf9/hbPANLYAWsgmTQAET4RZuUyqYgGoVQkYzBxBppCPrBRICskVY3FBQ0kBdey40Mo0Pceke80gG+hoL8hob8goZmh8OBPXV1JSX19SWHvMX4eHZTc4a2iWsRYU3kj+wy7fseX8SvQipkAihVoYQM2Wcz/05IR0lpUyqdFEpFRikUZkYqVSSbVeQ/Bvc2GsZLSj25tTVxq3TNOda69BAPSlUq0xNUx907W6Mf4/YWHx8vtzUasoxr8opHlLQ9JbNYra3Up6SrYmNY9fTYPemP1lec0HUxhQCI6A0c4PWG15oDorYAgl2+IvSO5BjRxSjMGiPMDBWKqcgIBUX/d//I0PjolsH14+0o6djjKHPtkgHuw/vv4s4NLAEEMb4iNCzcqWBNEawRq1gmKoKKxFLd+sEto+NDI/1rn18ygFbfdT9KG1iylnv38WPcJ52EHwfagJ7FfwMZAFJIFVKVgjYLNqRipOh67YEDmR6qXe7RX3995lhkRxR+pJphaltvvbW9gcmqbb3tNkCwDgZwL94ASwAQTdEszTIsQzG49/TA6dMDp5Hl7be7336bUFvkG4PX4ABZvVlCy1/bXuo+wH2NIsHngyaUg75D9wCGPwO5Vu+7CC/CQYI1KsguW0WblAaMERDYfTXoBcnTBC9CNEIvcN8OoxWSp398KIS3dBtg7MLnYAnEzNfD5FSy8WSvoxiDycTaxg4dGiMvdJjKczjyqEinw+GMxPRLLz351MzMUzXDbvdwTb2nqMhTDwi0AODFZ2ERgJxlZLRMe2YUj2zwqvAIIDBAOI7Gn8NqAHMuZo2ElJQ2ieRDpVIlpWR3dm8utditTjwk2de3aWdJX6UW2bnV99Zt3JJjc5U5PNu39RZf21+Y1lUnSOUyjsJfQoa4DoJJSvEfZEEqhl8IoUWzjMnkJ5q3b13ROmN+pjXfNFA6eHDRUEipw57f0r46pqYh15KdG7oZ791gaDTlNq8IiegqtbazmzewBQVskbUTGbP1FgvxeZkAuA+fgXBYBmBmESNjKLLfcgmTiapv6OgYXvT114cb0d+5jJ7Dh9HL3AOE41IA7MIfQSIAUlImP9MLuCVMypQ4gvsVVaer79daRmo3TS3bvKTc4nYXF2UVrBhEx/HWV2NTi4fspaP5gy06c6O7uCJLjX4BWKTxFayGVADgsc0jlMquVBqiFDS/0yJFdCLHWFWJV/fm5PdZzIPl68d0CPeOhvc/11DldpS4C3Fn5vYbNXrLYFnRkKPt2C40NFj1ZElhYU2l01VDVpYGgMPxBxAqaJ2SVeJw7stRFM3djP6OJ7178Nga4qXtvvM4H5/juTMARPjdDtm6IBaNJnOy6IYIi8G8VpkGKys2mSw6S37+eFnZWH5+NlpSZLcVlVgspTN11YWuqpp89KthUyvLtpqyGxRUV56z12TqdTo7qT/abBaDI8/wmtNucRdn2/KJRVQAwjn4S0FiJpGgyIaon/wG+VWI8PJefrY7f1UT4xywT45cP5ox0Llxi7T/ZGGJw1HiLr7DOHxdUgrbXza079mTkw/XDzc8XpZbWFGVZ6/y+QRrxjpIIp4GpLy/edjng0TfGHyKdaACGUShhwHDihgi27WwH32Iy4llpajMjFSBis+du+Wzz/Z/+umnnwKG7fAavgkvEc5fRCnZRZSSxTd5v8aR3q/xku7uT7u7CZ5h2I/OCXjkjEJKm4dvIXhwOUEDGNJ8F9Fn+EVQAA0AvFsgh7lfKSma7BUO8j9ocOfEQEjPIuWa9XaTKXejqa+gyx8mvDi8pm9d1f3GEtaWY7R1Gr3ZQRFDkY+VnMT7wQJuQikgYv5dUAmFmZGIuy7SF/4zK/xbY2LwvJ/w7441mdcXMTnShE6mosnhcTfRYT0GCRWTaoq546bxkwOHb+pyr2gb2fRw67Vf31lemMbqM5x0pg7vr7+rt/q2dm16WmZHdflUldXA/Z1auXp12ZBxz/7hl7dN7KfLVbV39R76+oD3jayaTL2drc/UmYnMkgDwYXwcpBAOkKKU0nJGTqskEnSe+9iw9eLUxW21I56bb8bHvcVfoQLuBWIDZQC4EE/DSogm94OwfKVMKdpBit9rRQgfFIMuVJo3FHJfojD3OmOeieNuynY4sm96L78o52f3oLa1uWxDFp7W1xhs1fJMRq9jOUm2gbGdJbue4ruE38CnII54SbJzJP4JcvRmRlT2lK6jazY/qToQ0+0oHLTbBwsd3TEHVE9uXnukC710pG1Tr9mUu6WiYovDZO4dbDuyDjC/kgfwNISDfG4faRkjMi5j0P2PtLU9svnTT3fs3btjZARPNzwwMHBfHZ72Hpvatv16jhxSBAt6Ax8np5ucIm5USSllSuqFb79Fy7kJNIHb3ux4vwMf7xCvncXTEMZrOrlaRsvQLHf23DkPnu54q4M7g6fFVf8NnwIlAJq/XCWrpJbjgA4ZohQ4P7Dkji3LuB/RniUdd7atPdIlCAR9Y2RzPWVlo7kbWtpaaq6vaTuybh2Rh8g7HsfT/Hkvo2VKGS1jZEoZHvdwJzwe5MbT3hKkJ0xxHyC1eAe8wEfaIJfRshc85BKeZ43vInoFT5PYBcmEM1k8FGTolZH29pFRpNVoMvE0t6RjcLAj02TWon+JPHTxuwBKxDOAGITQae57jwctP8S9ixhk5l7H09xLyM49zP1ClOOjeJr4AjNDKWXMC19xRz3t7Xha5FGiwtOwVFiVhJYQtHK5ROV5r+p9z87/9z2/rr9wyeSFp71/xUq/NPbj42R3lDTPCpIxeL+He8zjQU0eLPVexMe9l3AoYEjxXcRf4VOwguQDIXMBKK9DfIgwt21IdZRsxtqjnZ1H1wo7JbxL246SvSA7crStxzFWUbEllyjpmEPUzix+FZEAwGsmLeNJhJJQm6YYnGUYatzt+bZ6s/nZvMndu9GvO63cOTxt7swZsZo8vFdM8e3FP+BTICdecZEqNEhzeGtVQJTfSQkM474dWtMaP8N1JY94Hw7wWzho3z21LMB09726X6GbxxwBxkWubXgaloMCQCkJ8BwZKpUjv2dAv3mwiWe7qvYJbnJ3njPPuRtFcV/i6ezOHNfmSO5vaCTPZLIDghzfRZyIT5GsIyo1oFHG1FQVnxMFeQQiakU85jfgy+G8HSEOizU/3W5yNdhsg+6+SeluSb4pK1dlMxY22S2bSqVZrTZtjkVLa1Ytj0ipdNpa9X3NqSaDLjF91XJ5alU+22khWqECwEvxtHA6kfXQLF56wvM8nu7wHsOtHXxk5LuI+/E08SNymXDWyxiZPxyQ/bautKzOU7qrrGxnMZ7mCquqq6vQSc7dMJ6TM96ATgAid+IjeNofgTByOT7C/TjFXdrxx7cFE/P+DucTWnKfT/KeqN0SWiKRShi5nGj3e3+cvO3eiZntt9w3ceut/D3Lvd8hfNx7Gpu8b2GGj2MB94j2LqdVUlouYRRmBt3w4cT9t+/58OzEz+/Yg9q4X1y+jNpQO8cReisAcCWehsWEHkWzhByuPOf5bM9DD5HFXL6MTnK/RA0g4EeXBf9mJiExiaSoE6iAM6F87nfodE9PC/qxpwUQ3OErQr2SY36pEk+Ievv6zkiOdV7u6ArhT/yHfTU4T8gFFhGfcIZ7bxhpngrp+vEhQDDhK0LVAoZFNAnZWQZVn+nrO/N8l+QonxElw6N4Iz5OZGrmTzbJPeP/GDy/9YlH8Urvt2g/uWa3bwg/4fuQp0Hijie876YNDJBfwnElfCaJ5T0dpWI/+xgfqd+0RrCpC7gN6yGCnH/iqcQzIO73wlQkpXBrsXNN3OhoXG+ee7wQvaQr12jKdbqKDE25DvVPuJnUau/ZWpWxZF+duV6TUWexNGo1DRZCq8x3AU/gWT+t4JCbiE0WsoDWn/tyS8Zdrq3FeT1xHg+q0lVoMip4UhU65GWKJuvq9pUYVNV4lvvn/roMTb3F0qDRNlqEs/YCzsJ6kuVELLAsxjB30BbuqOrdp9i5It9QVFdX1JO4c9XU2qodhah/sqirOT2zp6Wlt6m+xz3ZMCer2Xmykv20rEpM/Qmjo7E9ecVbryIrnQqFe2Pr0q4QlkDLhfWggHgSmSqjgtn2+zwVT1CKXSFc26LmvPbUndH71lRd4y68pqZyh2sranZa6xcjHJ1fXVG+xj3Z0DBZ5NpZnewoL8sjMloFgAySED7qFZwBQyJKKimUohhkWDfqdPYNGtXr0GnOhE53qLqaulR6FS8J7lteaxJAR6INojHzcyc2iNOoBWJB/T2xo3nb64fvCB9Z1mAtbIjrcRRvLSzcWvz7YAFhPVGlM+VbXf2tGWx9dbuKLdlXVzfh/jRYUsJJV4Bn+ZMlKoqS0TIhRibemiR26JEey0hpXl6ZxxPXwmK9aaCMO4mMpVVVpdybeNZLpwq5OMBbEsxXhiC44qaQ0bJ1Yiid7cHD/ti5xHsWE1n4ZrlL4p2K+XfKI0NJusv7zwCGmgqrio4LwuNNrinpjknAt/tPbRrPkviB+DTeKswMSuHuedPjee3nSM794x//wLNc7T/n4pfZoPhl1huLZ8Wo4XWsF7KH+TKZLxxDlMJkYiSq9VZeRKKcYhuz8jfERg/YF0grIDWVIyk1mzVYISB//b+X/5H1OX68TVkL5U8wEfmn+i7gZqyHFUTfo34qBmG+3l1cOlFVNVFavq9KU6HPLNdoyjRthWHuyYb6vUVFe+vr97p71PU2W51aXWdrWUM8D3cJT8x5uWDPw7N5hefpdRRvJZ7HsTbhCs9z2eieIJ6HSeUel2hrrpvneYhtXLqqR5X9hJfI64kZHY1Z53SPXcVLGFOqL/8JNaZc4SWE2HEt1pPzM8LEUAGxf1BniSso9Hgw0o276rlPsKqa1IV8F9A5rCdVmqjUoDLHvws/FERE76634XGJPVPPWvNyKy3GNY7O0RCPxJSp1Sdmam0V2cjYlRemqzHQupS4hPgIWWK+SVOi7qpN0STFRsXLlq1U5rG6UjUgiAVAjfjpQGRBGE5lZWJhjjoTRxe1VtQ6naP70Wnu7YSYruIalNVx4ADJNop8/4NzsYpoGZrzuCQwESIUnOuJacpyinqMVd6zziSVaaAMubi3iKohhj8HATCLVeQUTZEzElrCoMT7tr97/Ts71qEXeYPmr5HosCoQk9D+mET3y22bN297Ysvo2NZhD6GA7uL6sYorJOEPOiHiR19g1RUxifmZya3DW5/h35GC++LkSbQCrTp5kr+H82IrVvHRAyI3yOXYyv3X+PDZPfc+hFWXP0BLcTzXjh4meQkAehyr+JiEoZSsnGaV1NOXuL0//oh2d3R0oE0dHUIk4EKPSx6FLAA5iYdVvFsSFCQySjFXnpMKJiXshNHMa8NuPbM4rM5VoElMCEVhDMsyYSg0IVFT4KoLW8zo0UOL9Krk7laTu7onLnFVtaw9h3EtwUtcTE67rHpVYlxPtdvU2p2s0i8CBP2+Q/CRREl8lIKWMR95PCMSUp1t9bnQfoFDCKUieZZEb2lM5dk1k46B0Wzylw0NPLuEfQo1/jSHRf8pg418ZPU1XoRuh2jRMyiCc3HxhKWZ2tzYjNjouIhoVUjdirrcWHVsVGLEalVILcqviYhYsVwZXy9+Cj2c7fAFNounib+sazQxUkZO/16tjie+n+lath2b/efAWY6vMOX7HsUs7iKZWDLPhNg6CW6ZiGEM2pO3dGDxUKNz89atm52NQ4sHluaZ3PX17vYMVVF3WFNT+C0DA7eGNzWFdRepMlorK0msqvZxOBO/AykAKZRSxSsHzTKBDJz219UUDEUTieNMLitSnbZoqIHKWVewcQhvyLaanEuX/OGXiwraOnK1LfmRUVUOa8FadluHyZGbH2dSViki17j5M/Vh9DmuhhiSdwAp44fSSSqpykz2VWVW8LUlhVRIAgOrejPBasjV2CwaG5MTl2BjcrXZFm2uwZrwM7MpNdXIpCJ7hpWxr462MdYMW26GlcmNjs5lrFrbRouBsVgYJjso0icxDkNJpZRQFCa+RqViGd6m0TO7H0t47TXPa68lPHbNfXsefHACHazF1vjaG2+sjbfiWqThnkR1ZD/ntJj01RgZLadlTL+H/EmU3C7vd2gKMKT7NDga/xZYcAIk+0+Y4DxvQYuHCnK3Ql6ZPFd5ptDpTOMaZ8eYR6LX6o0xTufaToctQ7cQZrdzvhKbtajEanVb7RptubapMi1TlapQKhV0Y4GpPir6SihbGz1mt2k0NpuGrC8cD6JMPHtlDGMI+q6l6ehomo6+XfzEg8Ln3AskkOm7gD8TawnW4IqisOblOHDukRM98K+Z9hcciRIyqak0+ufPm5t/vm7dA83ND6xru66k5Lq21utKSva35fVacnrs5UPyDcv0aWxeHpvKhm+QD1biU21H1q8/2tZ2dP36I22Z5Td1dNxYWXljR8dN5dWWDS5Xv6UmPzGpori4PCmxqIKsOgG1oZ/jGYggMcdVcp+gNgCVoK3IzMiTt7TI8tT6Sm27LV1ttarTbbioJjN+lZ47kqmI09UbWbvNaLRZjYBBC9vQNPoAFpHTwMxXixn+/UB7+1B3dy3/vu0p8Y/PWeAM7kC/JpUgRNGsksUdHi4H/frTG1rmdaJWAkAIGFAC+hN+EVZADKSTbHWhrCOCrMoUKlXQKmIBZDOlgeKFo4tlu2y2LpOpy1bc1FRc0thY0h4lZ8s1UkcfrR5NWrxkyeIk/KLJf5Gty8Td2FpS0kpezyoX15aV/R9Vgjxs8eLFfJ65E23DZ/iOF0mZt3G34TMNDYAhFrWhQ/h3sCzgZwP2EdxeiN1Qy9brsxrZ2j60KjtNZWbT0iy4Y01GDcvWaNZWs1Yra7LksIBgA+zBfXgTX6OjyGHI+Ft8FLrvdU5y+vTpgdfRlju7u+/svvvubtKRRN1IjV8lHBDuzHONqLkakhSpue8HlcpoeUQUbsXu3HS7MoMpQY8W51et1qxWxERG6HMSjfHJ2Uk6smcRqA2x+FVIv7LzdUXjS1QmKb26MjfVmZIUE5tcl5dXiZtDYhWKuPhVKUnRcTGr1OEN+GZLrD4uXrUYh6fHqy1WJipqFRWpyImKjFTQC/N5KWv+7OOP8clN9TtIRMhdwgXz4yQ+xA3ESQWemLYcW/pIIE5q0ukTuE8lWu5NPk4yEvw0AM7gK1+g5DNDmWicSpzRV9C3fHzrtjEUgzu9R9Dq0ba2LaRTakShMIMO812UELSMj2wuoWUghQhRNedkQLMMNVNcbJ7aFBsbG2su05sNBmvxSopaudNM6EeibjiKT811MCMPteBdLu5BFCva7f14htd80W7nND9YmxIMTSZTk4FpNpkas1CSNT3dkp1ObLZWq6kzsXVaba3JaLOajDlWBjAYYBv6rd9i5SrSmEnh32/t2tTRsQklCB8qv8mG8D2HfTyfYRBJfKfALZkjkAvHjZmhGJWUSTrUgt7h9g6iPTPalufv2qWd6ukRF2QjYwLegwUFhq/PHTlCuhJJPh++VcRKA8j5ihCppMn/rdY2mw61oFe4mwbR6F+vpr8CrWae1KGrqXIIqc/jN3lN1kI28d3/uT5fud70/5+G93BDG9FtT80J46dUvmm+iDAwvn70Hc6CJXP9MUE/hZ6YmVHMKQFDNAONign4sSv6ZDgrkIpnL+iU+XxCV0nyJCRBMt8hLICP4darwMfnwQ8G4DPwchB8XQD+KjwdBB8LwAfgxSD46wH4K3AObgVMshJJEz4OK4hVIX+PhlVKaaSkkEyCS7/5Bi3jJjlvxS60B73JTb6Lu/7U/FEL6Xy1cNejvdxu/qzhhF6Ubi7ONCy00YVpodgBeLU75kDy4d6cOfttvqVuYceqw2Ru37g4I2DXw2Gd93atC+5dEZ/B95t4KaaJ0t3Pr34hfHwe/GAAPgObguBjAfgADPDw5QDwFY9HI+IPuSp8XID7/kXyNh6/AJ/xfcXDvwNAUTx+AT7g+5zfjTAA/DjvJ2OCu27EYJlAy5AibcPHjrW1Hds8W1Exu33v3u0jzzwT6MChlH6U7n3whm3bD7zV/0dRKng/rytZoq78luea79PwXBuE1aDFV4WPz4MfDMBn4Jsg+LoA/FX4KAg+FoAPwNdwKyDYCTdgBy4jXjFFNTfKhn44fLjs7jtL7ryz7M67bjh8uOyw8P0w8WGrfRf5Xg3pq2YQ6QUKLlJ6LgBWmBlQIEG3klVICAzx7erMzqNr7Zu1OW29al3X0TX2Ya2lzftwJqpz1BcO2tFftNyTtsbCQTuu0O0sWne0LTnJMajfWbTuSFtyUi5X7EIjutwtFZ1O7ha9Y6yCyJTvavAyyhY14Sy/5oXw8XnwgwH4DJwKgo8F4APwAg/n8w0ej03E8xSvIULn67jQQ+I7X3yHIND7Sg1qfo3s4btfec7du5Gq03ozPn6TuTNnLNdsdnxFbNbk+wFfK1kETLBvDhUy+nkOmk+h+VQjMCgho2WmXbtKNrBZagWVkVvmGuxsG5FuwXptg8pYW5KSkhjvMLvtHnzz1qxKrbGAphTLIuKo6Bp7aVt3U0aWU6mSxTiyaCMdnx6drs13ej/GBl5nLuA2SSwkgQvIvhfAnwCuAh8PhuNLAfgMPB8Efz8AfxWOBcFnA/ABmA7Cnx2AvwJ/4T9TfBdCVmE9qCGLZGEgVcbjoHSeooMr0wYFy1Dza+mhQe1D4u1CVoVwJaEGd4rZvXxX9J5224BybVKfjdSrd5RtK+5Sd9vLxvPHUZsrtyP823JdoHiHQqN1LlpNl69h0uvq0hlSu54saqqszEwv3FkR66yudv63psFi8Rf0RJ9MehYagOT/0CXzGfPPEndGjTQE+WPXBsv8xkZTU/maxekBZzy0uGx7ZcNci0OUp4vfr2JxH58NyDkYPh4M5/exWNzH+4LgswH4ANzNwwWPS/D8AUjuVRByNeg4gQpemMctQGe+Ar8P5jEL0IHP/T2ZJvwZxPFTb/PyH0OUIlUlZc3EKBRmSooXbC1uKp2srdpdXLyzLKs8KZbZWZWUtoWKvKZmuEJHisqlmowSDbrwfP/tpUJpOTbOaUuzr05URkSm22O8r2kabLaGjIwGm60xw++3C3gdrhF1+Ai/dr62LUmBJKgVfc/vIewq8PF5cEkAPgPH5uD4kwD8VbgtCP6PAHwAjkIYSKAVynAzPshXocj5FNzVoJRscJ6PbGJ85OXw38Wv6KI/MOrq7uZ+NTfZKIFY3wVM6s4UxJPaDhKdO+/bA0NDoJD7PbtE9OxUQfm+qm53WlV5fulE1dqS9Coue/X5jBxNmQaVrP4mLVtToUd/qvDU73UbM+oqttTvLWI13H/p0KIkdZ0tV8tdSlDX24hM+XowrznNor7OwNXg48FwXqeaRX19Igg+G4APwGM8nK/K8njaRTxHea0TOglX7WHKrtbDPNvjFDoJzrVX9jD/ZRU6CXaGu13yJfd/x4NaCX4eeN7aRd6ug7m+jyqo76Pia9f8JIeEnLqrQc3XvYTgcL5NsEpKecWgxOfChE/GNVUdD3R2PtBetTsDTXDfeZ8JnpdAB5v/3LLZahWGJnIsAy3cb0YdjtGyMk9urqdM9L6I7zsxkLOwb6maz4fod0MWWGWK4IdDUAjXFlKf15G6M3pqTeEQnTJeWLW7uGyiyjWaQg+7K3e4vH1BdoqrUbPTXh+KQqMLayrK19iyzXbBam0mk821o+rNYGudddVUFwp5NErDl/g8U8qaFdTdhw4dwg83ttTVtZDdluIO+FySLdbF5ipUVGpQlvm5U69zOnV6Z14sFRkbG0nF4rtttiyDzWZYFRuriIqLixJy9k7Uit//6TpzhE0rj41cQS2TKSR5i21aeXxEhHwp+QffY126NDyconKsy5YuCYuiCM4mlIOH0D3+egse8n6B7unuFn6RFM79Iin0Roi/RKPX4V1x6ok2M3fu6q9Gr58n2BLR63BW/IWR0h27+qvx9HlhQvpu+B1cx09IM1I6f1d/9XXnARNcaD9/h1TAphAxbhWwnj9PpJiIXkc3Ba5ipLRZxP5PgYJw1SLf3WgLT0MqUPFT+p6ndv48IMjiLmGFZAXfX1HJabmUJQPhZqx4Zaln6Sv8G/pjuDcJfxLeEv7dd+H8HId4j5xURMwUP0rOKmTirRSq4e+bmZmZ4W//kGsNbwn//vvwlnB0TMBC6ua98AYaQGdI/mUKGkel/2Cly03Z5eXZb9DWZHN5udlcJsyV4no4CDTI4HUA8olu5/2HMGea7vtB4sV/4D1zNKRAFtjJ/OW/exYhlZ43HR70PTVoHDcxcHV64DEFh/CYwg2OeKUy/oT/MQVU15hPLshv/LNSGU9+QhR/BR6urXW76+rc/LML1voGdUZGOtcqAt3iZ316RkY6edXz3/iJ821wga+ciJXOA3PVTWGWZhtcFn6XB1dUVOLvDABm8HH/pDxmuJERdIiMauLj5PfVvksSKT5FzvjkgMkIbQszP1E+FxGRx1lIQ4m0L6IYHNIVc0D1xOax55LbSzEubU9+bmyI5KldjpLNce9/JZF89X7c5pI1rLF3cM9AZezKlbGVA3s29RpZl72SUiioylwXYFiFuvF5fAqkpK4mZyhaTsvpFBnp8PFNeoV51b+qUCuuwh/U4h772pot3X34lIubRbEu7sHz57//HnVfuCBaLF/F9VdIv+P6iF36fIGnBTDJ7AFDNQC8g0+IViOhJXKKZt9a1rXsmkl8gotGn3nfmJoiVusbh1+Ah/QeTVQkzRpYUgf9xW6TfUynvdHsVGwidFkAeA6meAumaPa5yampKUKlCABe5c8SQoWMzVM0++rk5CRWTU1xHVOkr0EoPIrTQMI/z0TRbMQcnYcmryeUcNrUFCcVyWGShYvzyzH++gw1VzAS55cJJn5ueTCoGrN48sp55Zd4Lqp9Y/AOzvR7EYpWMHK6enJSRtpomVOVXDQ5t1m0Ep5Dd4AUPgFAK/la0QD6DpOntEiDjWUooUbE+ruhczWipZN/XcANemRqyvvSAn74yKoWN+MJnpclQrV+ET/tTbPonknk4DDKm8QTU1OzfX0z114LCOJwHtwmSSS7FMEaGSqJIoWBuGE9ux5v0V1jsFDdC66ak/Ft/FVf63dlWSgyzRCH81A6f1XUPGwm/mvoHOYDI9Gr5vAbddcYYuOobhGDmsdAzaMUtYDosZGsOco5aoEBImUAXApTkESkDDR8wns5CXyC7gAhKv8By3GW0PlLDkzwM6nzCpcymk01mVjWn8fs77ezjfrNm+/DBdlMQdjw0n19+RsdWyYqmPtMjEGjNmaU6cp7rcXZhjaPZbCEe6E6XFmgR2plUhqfefyA5ZJYoIVcEzB8JWYkhJdLQAu55gL4LNBCTjkfzuMpuBKPJBtoMdecj+d9oIWcVYADhmTf/+B78CyoiHcLesLLZFYFj7dI6bk2jQIlB/VscEQbNZCf051taGBCk5SahpycBm3Y8GK1MjF9ZRTaxB10OjN1jrzMnZZS0xqbpcMkWawtSdGU67Ql6bGKiKhEtTqBSovl4hsLs7JcriyDi3iCHACsxGf5zuiCWjJfSuZnHUPqXTm5OXn84z9Du2p6dyAntxopageMRntFwfjO0a7CA2u3ddURz+K7jNPxWTJpB1crE/Nj3lI07blubODAIk9IUa6jpNix/jfcR+ipZ9Gp8d7B3eSpnlJnXknN811NzxPZmXwXsAqfBTnpg8/va5nljGR+bwtN9ec4RtwlHoc64ze7XoxXseXlLldVlQt9YN3oKhp25I0UWUZzEeK+D+cmagoLa8gLMKh9XhyL/xpMRSql5UFPNQR3Yzd6HOma3+z+Qzzt3pjjGCm+tcLlqiAv/Ne8Ebd9NPcyCg2zbSxyj+RxL5KTsrbWDf8LaBy3LAABAAAA9wCQAAwAdQAGAAEAAgAeAAYAAABkAAAAAwACAAAAAAAAAA0AKwBJAFwAjADZAR4BZQFyAY8BrQHPAeQB8gH6AhACIAJMAlsChQLDAt4DEANLA18DqQPhA+0D+QQJBB0ELQRiBMcE4QUYBUYFaQV/BZMFxwXgBe0GCQYjBjIGTgZkBpUGuAbwBxgHWQdrB4wHoQe/B9kH7wgECBYIJQg2CEgIVQhiCJgIzgj4CS4JYAl9CcMJ5goDCikKQApNCoMKpgrVCwsLQQtYC5gLtgvZC+sMCQwjDDkMTQySDJ4M4w0NDQ0NKg1aDZANzg31DggOZQ6KDuAPDw8oDzcPPw+JD5YPvw/YEAIQPRBKEG0QhxCQEK0QvBDoEQERLBFnEb0R8hH+EgoSFhIiEi4SOhJeEqESrRK5EsUS0RLdEukS9RMBEywTOBNEE1ATXBNoE3QTjhPWE+IT7hP6FAYUEhQ4FIIUjhSaFKYUshS+FMoVKBVmFXIVfhWKFZYVoRWsFbcVwhYIFhQWIBYsFjgWRBZQFn0WvhbKFtYW4hbuFvoXMBc8F0kXiRfhF/EYFxhBGE4YWxhoGHUYgRiUGKcYuRjTGPYZDRkdGYUZlRmlGbUZ9RoaGicaLxpDGlYaYhp0Go0atxrKGtMa/RsWGykbPBtdG30bjRvHG9Mb3xvrG/ccAxwPHFscgxytHOAdEwABAAAABAEGrHkz4l8PPPUAAwPoAAAAANikqcIAAAAA2xY2zP3n/boJ7AQ1AAAABwACAAAAAAAAeJx1kl1ozWEcxz+/73MO828h83q87Dj2n52xdRybt7a8drI9SMi0cKElu5MkomNc0JRduVEudRRKuVDaXChKarJSu1ZeEilDcePo/99RDBefnuf59Tz9fn0/j30BSwCU30G5zzayzzaTcUeo1SXaXIpGfWcJt8nYB87YB+bbN9brKYd5SVIddPGJnES7ztFmB2nSRvLaRU4XadZZOnWeTuVoUJF2nWY7X8lZjrR6OOQmcUo7OKoUDQmjoPtkdALvkoR6jFc1Xq5yfoi3KrxaWK5TeBvCu2N4jeDddELtxrsaQp3Eaz/r1MJS3aVT96hxb6nRFfI6wDQ1k7fXXNEw1+0VfRqgzi2iyA8ClQhVwmtfvIbqJbRtzI33/XH/Nqsqv1Lj+CyJafioriL18bsSofXhNZsmO84C9VPQBgK3lsA+E6hAYKMsV4KibaFXCbqVpS5yEGWvu2zSBRpVR1s0a3xnE1lbQ+Bm0WxPqLV3NKmfMMpeSfJ2nsBusUDDHLE9zLe9zOATgQbwOsESvtBicwgYYaYNxe/zuklGD8joDYuVYmWc+z9wV6mOs6+uuKhgVUwdp/zVqspjes6UXx4mokFOu+mkYhe/E7nYjdcgqyq5/0WinTB20fsnf/U/M+4n9jCRG3SrWHHxO4XYt4+dRC5XEybqCS1PwEcmWw+BHtHlrtHFGPMYI80oSSsxz0qk7TJJbWWFOsjbM3pUJJeoJ2tZmixLXp6VLkPKLWNu7Eq022J2MkKa97TaHAq8IB39/bj+ntbYxQ26ucPCCCuMo7O06iDhfylRpwOs0yFatYtVNP4EvCSoKXicY2BkYGCR+reIIYXz2t/nP0M53zAwMqCCbwCwfggheJxjYGGOZvzCwMrAwNTFFMHAwOANoRnjGIwYvRgYGBjYGOCAnQEJeIa4+TMcYFBQEmWR+reIIYUln6mYgYGBESTHpM60k4GBQYGBBQAAJQq5AAAAeJyNzqEKwlAYxfFz7xZn0QkiImc3mBZc1OwT6JP4Ar6DWBcMRgUVxCqG4TOIbJ8YNdvGJwyD0VP+5RcOAAvAAxDCg6nq4wQgBuEjADGDmsRMbGav9sYaQ7bZpWOPfQ454jpyru6aqgCICEuTmPFXB2ywxQ5Z6cGv1rs+9KxznZZavspn8ZaD7GUnW9nISlJZSFwc80ueVb/+3gei8Tf+AHicdZBfTsJAEMZ/C0iiJsYDENNHNUAJEqP4ItGY+GA0ygUKXaHasrXdmnAFj8EZfPYEHsp03Ifin4edfDPzffPtDLDNG3VUYxNYgcOKFiuHa+zw4XCdIZ8ONyqcDbZU0+EmLbX7jRWcq7bDij0VO1zjUDlfVaet3rnAkLIkI2LGHItHn548jzFzNB53wkqJWJBLnmF4QjMVxYgCyxxDJv19mWRJyRni4zMjEkbBhC5TDAm+1B4xFCwIyVji//A6+OV9gyYkoiDhHs2MgpiAjGvGXHHL2R8/rqrK/oAuPXoMmHBSydZ1nTXdAy8U4lTeJMRgZXbJ9Uhli/IeJccSYaSeiOKZnEvZdEKMpkOOlXtplngEjIixaDIWTv8qPgEJqdRzArnTf8w+bTyOJB5LPP0CGjNdrAAAAHicY2BmAIP/WxmMGLAAACzCAeoAAAEAAAAKABwAHgABREZMVAAIAAQAAAAA//8AAAAAAAB4nE3OOUoEYRiE4efvblwmcBBaQVEDmVja0cADDEaGBqaiXsAfBEPBQxibeAavoGhi6r6Pu7ikI90mk9T3FtRXlICawrq0Nb+wKF9d22hWuiyXQadT3SCRymIspo3GWDQ1YixmTMVYzJrTo+wqpaRACBUlhKSilJDK1CzZtlPlgz6JhrpTZ85duHTl2o1bd+49eNT2JKjL1A0aN2HSik1b9h04dOTYSVdbrtezdy9efXrzIZFoaWHX3v+6KlsubFe+v+t/QObLtx+/gsyQYSPG/gDRQjC7AAA=) format('woff')}",
    "@font-face{font-family:'Poppins';font-style:normal;font-weight:600 700;font-display:swap;src:url(data:font/woff;base64,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) format('woff')}"
  ].join("\n");
  var CSS = [
    FONT_FACES,
    "@page{size:A4 landscape;margin:8mm}",
    ".psr{--ink:#14233a;--mut:#5b6b82;--soft:#8796ab;--line:#dbe3ee;--bg:#eef3f9;--card:#fff;--navy:#0f2a4a;--navy2:#1b4f8f;--blue:#2f6fde;--sky:#e3ecf8;--slate:#334155;",
    "--done:#2f6fde;--ok:#2e9e6b;--risk:#e0a100;--late:#d64545;--ns:#94a3b8;",
    "font-family:" + FONT_STACK + ";color:var(--ink);font-size:12px;line-height:1.45}",
    ".psr *{box-sizing:border-box}",
    // page = light blue-grey canvas with a navy header band
    ".page{background:var(--bg);width:1123px;min-height:794px;margin:0 auto 28px;padding:0 32px 14px;box-shadow:0 6px 28px rgba(15,42,74,.18);display:flex;flex-direction:column;gap:14px;page-break-after:always;break-after:page;overflow:hidden}",
    ".rh{display:flex;justify-content:space-between;align-items:center;gap:24px;margin:0 -32px;padding:18px 32px 16px;background:linear-gradient(110deg,var(--navy) 0%,#163a66 60%,var(--navy2) 100%);color:#fff}",
    ".rh-l{display:flex;align-items:center;gap:18px}.hlogo{height:22px;width:auto;flex:0 0 auto;padding-right:18px;border-right:1px solid rgba(255,255,255,.25)}.vendor{font-size:10.5px;letter-spacing:.4em;font-weight:700;color:#8fb4e8}",
    ".rh h1{margin:3px 0 2px;font-size:24px;font-weight:700;letter-spacing:-.01em;color:#fff}",
    ".sub{color:#b9cbe4;font-size:12px}.sub b{color:#fff}",
    ".rh-r{text-align:right;display:flex;align-items:center;gap:14px}.rh-r .meta{order:1}.rh-r .clogo{order:3}.rh-r .badge{order:2}",
    ".clogo{display:block;max-height:42px;max-width:150px;background:#fff;border-radius:6px;padding:4px 8px}.clogo.ph{width:112px;height:40px;border:1.5px dashed rgba(255,255,255,.45);background:transparent;border-radius:6px;color:#b9cbe4;font-size:9px;font-weight:700;letter-spacing:.12em;display:flex;align-items:center;justify-content:center}",
    ".meta{font-size:11.5px;color:#b9cbe4;line-height:1.5}.meta b{color:#fff}",
    ".badge{display:inline-block;padding:4px 10px;border-radius:999px;font-size:9.5px;font-weight:700;letter-spacing:.1em}",
    ".b-int{background:#d64545;color:#fff}.b-ext{background:rgba(255,255,255,.16);color:#fff;border:1px solid rgba(255,255,255,.35)}",
    // hero tiles – solid colour blocks
    ".hero{display:grid;grid-template-columns:1.1fr 1.1fr .8fr 1.6fr;gap:12px}.hero.h5{grid-template-columns:repeat(5,1fr)}",
    ".tile{background:var(--card);border-radius:12px;padding:13px 18px;box-shadow:0 1px 3px rgba(15,42,74,.08);border-left:4px solid var(--navy2)}",
    ".tl-k{font-size:10px;text-transform:uppercase;letter-spacing:.09em;color:var(--mut);font-weight:700}",
    ".big{font-size:28px;font-weight:700;line-height:1.15;margin:3px 0 5px;color:var(--navy)}.big small{font-size:13px;font-weight:500;color:var(--mut)}",
    ".tl-s{font-size:11px;color:var(--mut)}",
    ".tile.t-status{background:linear-gradient(135deg,#475569,#64748b);border-left:0;color:#fff}.t-status .tl-k,.t-status .tl-s{color:rgba(255,255,255,.82)}.t-status .big{color:#fff}",
    ".t-status .big:before{content:'';display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:10px;vertical-align:3px;background:#fff;box-shadow:0 0 0 4px rgba(255,255,255,.25)}",
    ".tile.t-status.s-done{background:linear-gradient(135deg,#1d4fb8,#3a7bec)}.tile.t-status.s-ok{background:linear-gradient(135deg,#17734a,#2e9e6b)}",
    ".tile.t-status.s-risk{background:linear-gradient(135deg,#b07800,#e0a100)}.tile.t-status.s-late{background:linear-gradient(135deg,#a92d2d,#d64545)}",
".tile.t-prog{background:linear-gradient(135deg,var(--navy2),var(--blue));border-left:0;color:#fff}.t-prog .tl-k,.t-prog .tl-s{color:#d3e2f8}.t-prog .big{color:#fff}",
    ".t-prog .pbar{background:rgba(255,255,255,.25)}.t-prog .pfill{background:#fff}.t-prog .pmark{background:#ffd34d}",
    ".tile.t-live{background:var(--slate);border-left:0;color:#fff}.t-live .tl-k,.t-live .tl-s{color:#c3cddb}.t-live .big{color:#fff}.t-live .big small{color:#c3cddb}",
    ".tile.t-done{border-left-color:var(--done)}.tile.t-ok{border-left-color:var(--ok)}.tile.t-risk{border-left-color:var(--risk)}.tile.t-late{border-left-color:var(--late)}",
    ".tile.t-late .big{color:var(--late)}.tile.t-risk .big{color:#b78300}.tile.t-done .big{color:var(--done)}",
    ".pbar{position:relative;height:8px;background:#dfe6f0;border-radius:4px;margin:2px 0 6px}.pfill{height:100%;background:var(--navy2);border-radius:4px}.pmark{position:absolute;top:-4px;width:3px;height:16px;background:var(--late);border-radius:2px}",
    ".hbar{display:flex;gap:2px;height:12px;border-radius:6px;overflow:hidden;margin:9px 0 8px}.hleg{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:11px;color:var(--mut)}.hleg b{color:var(--ink);margin:0 2px 0 4px}",
    ".rat{margin:0;color:var(--slate);font-size:12.5px;background:var(--card);border-left:4px solid var(--blue);border-radius:0 10px 10px 0;padding:9px 16px;box-shadow:0 1px 3px rgba(15,42,74,.06);}",
    ".rat.ph{color:var(--soft);font-style:italic;border-left-color:#c3cfdf}",
    ".cols3{display:grid;grid-template-columns:1fr 1fr 1.1fr;gap:12px}.cols2{display:grid;grid-template-columns:1fr 1fr;gap:14px}",
    ".card{background:var(--card);border-radius:12px;padding:0 16px 12px;box-shadow:0 1px 3px rgba(15,42,74,.08);overflow:hidden}",
    ".st{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--navy);background:var(--sky);margin:0 -16px 10px;padding:8px 16px;border-left:4px solid var(--navy2)}",
    ".st.c-done{border-color:var(--done)}.st.c-ok{border-color:var(--ok)}.st.c-late{border-color:var(--late)}",
    ".cnt{font-weight:700;color:#fff;background:var(--navy2);border-radius:999px;padding:1px 8px;letter-spacing:0;text-transform:none;margin-left:6px;font-size:10.5px}",
    "ul.ll{margin:0;padding:0;list-style:none}ul.ll li{position:relative;margin:0 0 7px;padding-left:16px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}",
    "ul.ll li:before{content:'';position:absolute;left:2px;top:6px;width:6px;height:6px;border-radius:2px;background:var(--navy2)}",
    "ul.att,ul.al{margin:0;padding:0;list-style:none}ul.att li{display:flex;gap:10px;align-items:flex-start;margin-bottom:8px}ul.att .dot{margin-top:4px;flex:none}",
    ".an{font-weight:600}.as{font-size:11px;color:var(--mut)}ul.al li{margin-bottom:8px}.amt{font-weight:400;color:var(--mut)}",
    ".more{font-size:10.5px;color:var(--blue);margin-top:2px;cursor:pointer;display:inline-block;font-weight:600;user-select:none}.more:hover{text-decoration:underline}.card:not(.xp) .xtra{display:none}",
    ".rat .clamp{cursor:pointer}.rat.xp .clamp{-webkit-line-clamp:unset;display:block;overflow:visible}",
    ".muted{color:var(--mut)}em.int{font-size:9px;font-style:normal;background:#fde8e8;color:var(--late);padding:0 5px;border-radius:3px;margin-left:4px}",
    "table{width:100%;border-collapse:collapse}th{font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--navy);background:var(--sky);text-align:left;padding:7px 8px}",
    "td{padding:6px 8px;border-bottom:1px solid #edf1f6;vertical-align:top}tbody tr:nth-child(even) td{background:#f7f9fc}tbody tr:last-child td{border-bottom:0}",
    ".c{text-align:center}.r{text-align:right}.nowrap{white-space:nowrap}.b{font-weight:700}",
    "table.iss td{padding:7px 8px;background:none!important}.w-dot{width:22px}.w-dot .dot{margin-top:3px}.w-topic{width:42%;font-weight:600}.w-imp{width:50px}",
    ".w-act{color:var(--mut);font-size:11.5px}.clamp{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}",
    ".w-own{width:110px;font-size:11px;color:var(--mut);white-space:nowrap}.w-own b{color:var(--ink);font-weight:600}",
    ".imp-t{font-size:10px;font-weight:700;color:#fff;background:var(--navy2);padding:1px 6px;border-radius:3px}",
    ".tag{display:inline-block;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--navy2);background:var(--sky);border-radius:3px;padding:0 5px;margin-right:6px}",
    "table.mst{background:var(--card);border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(15,42,74,.08)}table.mst td{padding:7px 8px}",
    ".pv{display:inline-block;width:40px;text-align:right;font-variant-numeric:tabular-nums;font-weight:700;color:var(--navy)}",
    ".mbar{display:inline-block;vertical-align:middle;width:80px;height:8px;background:#e3e9f1;border-radius:4px;overflow:hidden}.mfill{height:100%}",
    ".mini{white-space:nowrap;color:var(--mut);font-size:11px;margin-left:6px}.mini .mbar{width:40px;margin-right:4px}",
    ".dot{display:inline-block;width:10px;height:10px;border-radius:50%;vertical-align:middle}",
    ".s-done{background:var(--done)}.s-ok{background:var(--ok)}.s-risk{background:var(--risk)}.s-late{background:var(--late)}.s-ns{background:var(--ns)}",
    ".s-donet{color:var(--done)}.s-okt{color:var(--ok)}.s-riskt{color:#b78300}.s-latet{color:var(--late)}.s-nst{color:var(--soft)}",
    ".chip{display:inline-block;padding:2px 9px;border-radius:999px;font-size:10px;font-weight:700;white-space:nowrap;background:#e6ebf2;color:var(--mut)}",
    ".chip.s-done{background:var(--done);color:#fff}.chip.s-ok{background:var(--ok);color:#fff}.chip.s-risk{background:var(--risk);color:#fff}.chip.s-late{background:var(--late);color:#fff}",
    ".rf{margin-top:auto;display:flex;justify-content:space-between;align-items:center;font-size:10px;color:var(--mut);padding-top:8px;border-top:1px solid var(--line)}",
    ".leg .dot{width:8px;height:8px;margin:0 4px 0 12px}.leg .dot:first-child{margin-left:0}.imp{margin-left:18px}.rf .pg{letter-spacing:.12em;font-weight:700;color:var(--navy)}",
    // timeline
    ".tl{border-radius:12px;overflow:hidden;background:var(--card);box-shadow:0 1px 3px rgba(15,42,74,.08)}",
    ".tl-row{display:grid;grid-template-columns:270px 56px 110px 1fr;align-items:center;border-top:1px solid #edf1f6;min-height:38px}.tl-row:nth-child(odd):not(.tl-head){background:#f7f9fc}",
    ".tl-row>div{padding:4px 10px}.tl-head{background:var(--navy);font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:#cfe0f7;border-top:0;min-height:38px}",
    ".pn{font-weight:600;font-size:12.5px}.pd{font-size:10px;color:var(--soft)}.stx{font-size:11px;color:var(--mut)}",
    ".gantt{position:relative;height:38px;padding:0!important;align-self:stretch}.gantt i{position:absolute;top:0;bottom:0;border-left:1px solid #e6ecf3}.tl-head .gantt i{border-color:rgba(255,255,255,.12)}",
    ".gh{height:38px}.gh span{position:absolute;top:19px;text-align:center;font-size:10px;text-transform:none;letter-spacing:0;color:#cfe0f7}",
    ".here{position:absolute;top:3px;transform:translateX(-50%);background:#ffd34d;color:var(--navy);font-weight:700;font-size:9px;padding:1px 6px;border-radius:3px;white-space:nowrap;text-transform:none;letter-spacing:0}",
    ".gbar{position:absolute;top:12px;height:14px;border-radius:7px;overflow:hidden}.gbar .gfill{display:block;height:100%}",
    ".gbar.s-done{background:#c9d8f6}.gbar.s-done .gfill{background:var(--done)}.gbar.s-ok{background:#cdeadb}.gbar.s-ok .gfill{background:var(--ok)}",
    ".gbar.s-risk{background:#f6e7b8}.gbar.s-risk .gfill{background:var(--risk)}.gbar.s-late{background:#f5cfcf}.gbar.s-late .gfill{background:var(--late)}.gbar.s-ns{background:#dde4ee}.gbar.s-ns .gfill{background:var(--ns)}",
    ".dia{position:absolute;top:13px;width:12px;height:12px;transform:translateX(-50%) rotate(45deg)}",
    ".today{position:absolute;top:0;bottom:0;width:2px;background:#e8b400}",
    ".tl-note{font-size:10.5px;color:var(--soft)}",
    ".stack{display:flex;height:16px;border-radius:8px;overflow:hidden;background:#dfe6f0}.hatch{background-image:repeating-linear-gradient(45deg,rgba(255,255,255,.5) 0 4px,transparent 4px 8px)}",
    ".stack-l{display:flex;gap:16px;font-size:11px;color:var(--mut);margin-top:6px}.stack-l i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px;vertical-align:middle}",
    "tr.grp td{background:#dbe6f4!important;font-weight:700;color:var(--navy);padding:7px 10px}",
    "table.acts{background:var(--card);border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(15,42,74,.08)}table.acts td{font-size:11.5px;padding:4px 8px}",
    // steering page
    ".sg-sum{display:flex;gap:12px;align-items:stretch}.sg-k{display:flex;align-items:center;gap:12px;border-radius:12px;padding:10px 18px;color:#fff;min-width:230px}",
    ".sg-k b{font-size:30px;line-height:1}.sg-k span{font-size:12px;font-weight:600;line-height:1.3}.sg-k small{font-weight:400;opacity:.85}",
    ".sg-dec{background:linear-gradient(135deg,var(--navy),var(--navy2))}.sg-ack{background:linear-gradient(135deg,#475569,#64748b)}",
    ".sg-note{flex:1;align-self:center;font-size:11px;color:var(--mut);background:var(--card);border-radius:10px;padding:10px 14px;box-shadow:0 1px 3px rgba(15,42,74,.06)}",
    "table.sg{background:var(--card);border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(15,42,74,.08)}table.sg th{background:var(--navy);color:#dbe7f7;padding:9px 10px}",
    "table.sg td{padding:9px 10px;font-size:12px}.sg-n{width:30px;text-align:center;font-weight:700;color:var(--navy2)}.sg-t{width:30%}.sg-a{width:27%}.sg-o{width:110px;font-size:11px;color:var(--mut);white-space:nowrap}.sg-o b{color:var(--ink)}",
    "td.sg-a{background:#eef4fd!important;color:var(--navy);font-weight:600;border-left:3px solid var(--navy2)}",
    ".sg-pill{display:inline-block;font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;border-radius:3px;padding:1px 6px;margin-bottom:4px;color:#fff}.p-dec{background:var(--navy2)}.p-ack{background:#64748b}",
    ".clamp3{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}",
    // calendar page
    ".cal-top{display:flex;justify-content:space-between;align-items:center}.cal-rng{font-size:15px;font-weight:700;color:var(--navy)}.cal-rng span{font-weight:400;color:var(--mut);font-size:12px}",
    ".cal-leg{display:flex;gap:16px;font-size:11px;color:var(--mut);align-items:center}.cal-leg i{display:inline-block;width:18px;height:9px;border-radius:5px;margin-right:6px;vertical-align:middle}",
    ".cal-leg i.ow-h{background:#3b74d9}.cal-leg i.ow-c{background:#f6b26b}.cal-leg i.ow-j{background:#94a3b8}.cal-leg .la-dm{margin-right:6px;position:relative;top:0}",
    ".la-legrd{width:3px!important;height:14px!important;border-radius:2px!important;background:#f2b705}",
    ".la{background:var(--card);border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(15,42,74,.08)}",
    ".la-r{display:grid;grid-template-columns:minmax(0,1fr) 84px 84px 50%;border-top:1px solid #edf1f6;min-height:34px}.la-r:first-child{border-top:0}",
    ".la-c{display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--mut);font-variant-numeric:tabular-nums;border-left:1px solid #edf1f6}.la-c.late{color:var(--late);font-weight:700}.la-hd .la-c,.la-hd .la-l{color:#cfe0f7;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;border-color:rgba(255,255,255,.12)}.la-key .la-c{border-color:var(--line)}.la-l{display:flex;align-items:center;gap:8px;padding:0 12px;font-size:12px;font-weight:600;color:var(--ink);min-width:0}.la-l span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".la-t{position:relative;min-height:34px}",
    ".la-hd{background:var(--navy);border-top:0}.la-hd .la-t{height:46px}",
    ".la-wh{position:absolute;top:6px;font-size:9px;overflow:hidden;color:#9fb8da;padding-left:8px;white-space:nowrap;border-left:1px solid rgba(255,255,255,.15);height:40px}.la-wh b{color:#fff;font-weight:700;margin-right:3px}",
    ".la-dn span{position:absolute;top:26px;text-align:center;font-size:9.5px;color:#cfe0f7}.la-dn span.past{color:#6f8bb0}.la-dn span.rd{color:var(--navy);background:#ffd34d;border-radius:3px;font-weight:700}",
    ".la-wk{position:absolute;top:0;bottom:0;background:transparent}.la-wk.odd{background:#f6f9fd}.la-we{position:absolute;top:0;bottom:0;background:#eef2f7}",
    ".la-rd{position:absolute;top:0;bottom:0;width:2px;margin-left:-1px;background:#f2b705;z-index:1}",
    ".la-ow{flex:none;width:10px;height:10px;border-radius:3px}.la-ow.ow-h{background:#3b74d9}.la-ow.ow-c{background:#f6b26b}.la-ow.ow-j{background:#94a3b8}",
    ".la-b{position:absolute;top:11px;height:12px;border-radius:6px;z-index:2}.la-b.lo{border-top-left-radius:0;border-bottom-left-radius:0}.la-b.ro{border-top-right-radius:0;border-bottom-right-radius:0}",
    ".la-b.ow-h{background:#3b74d9}.la-b.ow-c{background:#f6b26b}.la-b.ow-j{background:#94a3b8}.la-b.dn{opacity:.45}",
    ".la-dt{position:absolute;top:9px;margin-left:6px;font-size:10px;color:var(--mut);white-space:nowrap;z-index:2}.la-dt.in{margin:0 6px 0 0;top:-1px;font-size:9px}",
    ".la-late .la-l span{color:var(--late)}",
    ".la-key{background:#fbfcfe;border-bottom:1px solid var(--line)}.la-key .la-l{color:var(--navy2);font-size:11px;text-transform:uppercase;letter-spacing:.06em}",
    ".la-k{position:absolute;transform:translateX(-7px);display:flex;align-items:center;gap:5px;font-size:10.5px;font-weight:700;color:var(--navy);white-space:nowrap;z-index:3}.la-k small{font-weight:500;color:var(--mut)}",
    ".la-dm{display:inline-block;width:11px;height:11px;transform:rotate(45deg);border-radius:2px}.la-dm.ow-h{background:#3b74d9}.la-dm.ow-c{background:#f2994a}.la-dm.ow-j{background:#64748b}",
    // activity states
    ".ast{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.ast-i{display:inline-flex;align-items:center;gap:8px;border-radius:999px;padding:4px 14px 4px 5px;font-size:11.5px;font-weight:600;background:var(--card);box-shadow:0 1px 3px rgba(15,42,74,.08)}",
    ".ast-i b{display:inline-block;min-width:26px;text-align:center;border-radius:999px;padding:2px 7px;color:#fff;font-size:12px}",
    ".ast-i.a-done b{background:var(--ok)}.ast-i.a-prog b{background:var(--blue)}.ast-i.a-behind b{background:var(--risk)}.ast-i.a-late b{background:var(--late)}.ast-i.a-ns b{background:var(--ns)}.ast-i.a-hold b{background:#b07800}",
    ".ast-n{font-size:10.5px;color:var(--mut);margin-left:auto}",
    ".ac-card{padding:0}.ac-card table.acts{box-shadow:none;border-radius:0}",
    "table.acts td{vertical-align:middle}tr.ar td{background:#fff!important}tr.ar td:first-child{border-left:4px solid transparent}",
    "tr.ar.a-done td{color:#6b7a8f}tr.ar.a-done td:first-child{border-left-color:var(--ok)}",
    "tr.ar.a-prog td:first-child{border-left-color:var(--blue)}tr.ar.a-behind td{background:#fffaf0!important}tr.ar.a-behind td:first-child{border-left-color:var(--risk)}",
    "tr.ar.a-late td{background:#fdf1f1!important}tr.ar.a-late td:first-child{border-left-color:var(--late)}tr.ar.a-late .a-nm{font-weight:600;color:#8f2424}",
    "tr.ar.a-ns td:first-child{border-left-color:#d3dae4}tr.ar.a-hold td:first-child{border-left-color:#b07800}tr.ar.a-na td{color:var(--soft);text-decoration:line-through}",
    ".achip{display:inline-block;border-radius:999px;padding:2px 9px;font-size:10px;font-weight:700;color:#fff;letter-spacing:.02em}",
    ".achip.a-done{background:var(--ok)}.achip.a-prog{background:var(--blue)}.achip.a-behind{background:var(--risk)}.achip.a-late{background:var(--late)}",
    ".achip.a-ns{background:#e6ebf2;color:var(--mut)}.achip.a-hold{background:#b07800}.achip.a-na{background:#e6ebf2;color:var(--soft)}",
    ".a-ld{font-size:10px;font-weight:700;color:var(--late);margin-top:2px}",
    ".abar{display:inline-block;vertical-align:middle;width:60px;height:7px;border-radius:4px;background:#e3e9f1;overflow:hidden;margin-right:6px}.abar i{display:block;height:100%}",
    ".abar i.a-done{background:var(--ok)}.abar i.a-prog{background:var(--blue)}.abar i.a-behind,.abar i.a-lstart{background:var(--risk)}.abar i.a-late{background:var(--late)}.abar i.a-hold{background:#b07800}",
    ".apv{font-size:11px;color:var(--navy);font-variant-numeric:tabular-nums}.a-rm{font-size:10.5px;color:var(--soft);max-width:260px}",
    "tr.grp td .g-name{font-weight:700;margin-right:10px}tr.grp .chip{margin-right:12px}.g-bar{display:inline-flex;align-items:center;gap:6px;margin-right:12px}.g-bar b{font-size:11px}.g-tg{font-size:10.5px;font-weight:500;color:var(--mut)}",
    ".tl.ko .tl-row{grid-template-columns:300px 64px 64px 1fr}.gbar.ko-i{background:#3b74d9}.gbar.ko-c{background:#f6b26b}.gbar.ko-g{background:var(--blue)}.dia.ko-g,.dia.ko-i{background:var(--blue)}.dia.ko-c{background:#f2994a}",
    ".tl-row.ko-ch{background:#fff4e8!important;min-height:24px}.tl-row.ko-ch div{font-size:10px;font-weight:700;color:#9a4a05;letter-spacing:.06em}",
    ".kod{--kn:#13284c;--ki:#262626;--kg:#595959;--ks:#8c8c8c;--kl:#d9d9d9;--kb:#4472c4;--kb2:#2f5597;--ko:#ff9823;--ko2:#ffb14b;--kr:#c00000}",
    ".kos{position:relative;width:1123px;height:632px;margin:0 auto 24px;background:#fafafa center/cover no-repeat;box-shadow:0 6px 28px rgba(15,42,74,.18);overflow:hidden;color:var(--ki);break-after:page;page-break-after:always;box-sizing:border-box}",
    ".kos *{box-sizing:border-box}",
    ".ko-conf{position:absolute;top:10px;right:34px;font-size:8px;letter-spacing:1px;color:var(--ks)}.ko-conf.dk{color:#8fa3bf}",
    ".ko-logo{position:absolute;right:42px;bottom:16px;height:19px}.ko-logo.txt{font-weight:700;font-size:13px;letter-spacing:2px;color:var(--kn)}.ko-logo.txt.dk{color:#fff}",
    ".ko-num{position:absolute;left:50px;bottom:18px;font-size:8px;color:var(--ks)}",
    ".ko-bar{position:absolute;left:50px;top:42px;width:50px;height:4px;background:var(--kb)}",
    ".kos h2{position:absolute;left:50px;top:52px;margin:0;font-size:24px;font-weight:700;letter-spacing:3px;color:var(--ki)}",
    ".ko-sub{position:absolute;left:50px;top:96px;font-size:11.5px;color:var(--kg)}",
    ".ctr .ko-bar{left:536px}.ctr h2,.ctr .ko-sub{left:0;right:0;text-align:center}",
    ".ko-body{position:absolute;left:50px;right:50px;top:132px;bottom:46px}",
    ".ko-cover h1{margin:0;font-size:38px;font-weight:700;letter-spacing:3px;color:var(--kb)}",
    ".ko-cv{position:absolute;left:387px;top:190px;right:60px}.ko-cvs{font-size:16px;color:var(--kg);margin-top:6px}.ko-cvd{font-size:12.5px;color:var(--ks);margin-top:4px}",
    ".ko-cl{display:block;margin-top:36px;width:168px;height:72px;object-fit:contain}.ko-cl.ph{border:1px dashed var(--kl);display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--ks)}",
    ".ko-agl{position:absolute;left:50px;top:122px;margin:0;padding:0;list-style:none;width:620px}.ko-agl li{display:flex;align-items:center;height:60px;font-size:14px;letter-spacing:1px}",
    ".ko-agl b{width:68px;font-size:20px;color:var(--kb)}.ko-agi{z-index:2;position:absolute;right:0;top:0;bottom:0;width:387px;background:center/cover}",
    ".ko-part{background-color:var(--kn);color:#fff;text-align:center;display:flex;flex-direction:column;justify-content:center;align-items:center;padding-bottom:40px}",
    ".ko-part h1{margin:4px 80px 0;font-size:32px;font-weight:700;letter-spacing:1px;color:#fff}.ko-pn{font-size:18px;font-weight:700;letter-spacing:3px;color:#8fb4e8}",
    ".ko-sq{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:3px;background:var(--kb2);color:#fff;font-weight:700;font-size:13px}",
    ".ko-obj{list-style:none;margin:0;padding:0;position:absolute;left:420px;right:0;top:-12px}.ko-obj li{display:flex;align-items:center;gap:20px;height:70px;font-size:15px}.ko-obj b{color:var(--kb2)}",
    ".ko-strip{z-index:2;position:absolute;left:0;right:0;bottom:0;height:287px;background:center/cover}",
    ".ko-scope{display:grid;grid-template-columns:1fr 330px 1fr;gap:22px;align-items:start}.ko-col{display:flex;flex-direction:column;gap:15px}",
    ".ko-scope3{display:grid;grid-template-columns:repeat(3,1fr);gap:15px 22px}",
    ".ko-mod{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #e7e7e7;border-radius:8px;padding:12px 14px;min-height:84px;box-shadow:0 2px 6px rgba(0,0,0,.06)}",
    ".ko-mod b{display:block;font-size:11.5px}.ko-mod small{display:block;font-size:9.5px;color:var(--kg);line-height:1.35;margin-top:2px}",
    ".ko-ic{flex:0 0 38px;height:38px;border-radius:50%;background:#e9eef8;color:var(--kb2);font-weight:700;display:flex;align-items:center;justify-content:center}",
    ".ko-core{background:var(--kn);border-radius:10px;padding:12px 20px 16px;color:#fff}.ko-core h3{margin:0 0 6px;text-align:center;font-size:15px;letter-spacing:2px}",
    ".ko-core div{padding:8px 0}.ko-core b{display:block;font-size:11px;color:#8fb4e8}.ko-core small{display:block;font-size:9.5px;line-height:1.35}",
    ".ko-t{width:100%;border-collapse:collapse;background:#fff;font-size:10px}.ko-t th{text-transform:none;letter-spacing:0;font-size:10px;background:var(--kn);color:#fff;font-weight:700;padding:9px 8px;text-align:center;border:1px solid var(--kl)}",
    ".ko-t td{border:1px solid var(--kl);padding:7px 8px;vertical-align:middle;line-height:1.35}.ko-t .b{font-weight:700}.ko-t .c{text-align:center}.ko-t .g{color:var(--kg)}.ko-t .sm{font-size:9px}.ko-t .nowrap{white-space:nowrap}",
    ".ko-int,.ko-pay,.ko-doc{width:calc(100% - 34px);margin:0 17px}.ko-int td{height:35px}.ko-int .dir{color:#fff;font-weight:700;text-align:center;font-size:9.5px;background:var(--ks)}.dir.in{background:#70ad47}.dir.out{background:var(--ko)}.dir.two{background:var(--kb)}",
    ".ko-pay .pct{font-weight:700;color:var(--kb2)}",
    ".ko-ben{list-style:none;margin:0 50px;padding:0;display:grid;grid-template-columns:1fr 1fr;row-gap:22px;column-gap:40px}.ko-ben li{display:flex;align-items:center;gap:16px;font-size:13px}",
    ".ko-meth{display:grid;grid-template-columns:repeat(5,1fr);gap:18px;height:380px}.ko-meth>div{position:relative;background:#fff;border:1px solid #e7e7e7;border-radius:8px;padding:20px;box-shadow:0 2px 6px rgba(0,0,0,.06)}",
    ".ko-meth>div:after{content:\"\";position:absolute;right:0;top:8px;bottom:8px;width:8px;background:var(--t)}",
    ".ko-mn{display:flex;width:42px;height:42px;border-radius:50%;background:var(--t);color:#fff;font-weight:700;font-size:14px;align-items:center;justify-content:center}",
    ".ko-meth h4{margin:12px 0 10px;font-size:13px;letter-spacing:1px;color:var(--t)}.ko-meth ul{margin:0;padding-left:14px;font-size:12px;color:var(--kg)}.ko-meth li{margin-bottom:7px}",
    ".ko-org{display:flex;flex-direction:column;gap:9px;height:430px;position:relative}",
    ".ko-orgk{position:absolute;right:0;top:-34px;display:flex;gap:14px;font-size:10px;font-weight:700;letter-spacing:1px}.ko-orgk span{display:flex;align-items:center;gap:6px}.ko-orgk span:before{content:'';width:10px;height:10px;border-radius:50%}.ko-orgk .c{color:#1f3864}.ko-orgk .c:before{background:#1f3864}.ko-orgk .h{color:#c55a11}.ko-orgk .h:before{background:#ed7d31}",
    ".ko-tr{flex:1;display:grid;grid-template-columns:150px 1fr;gap:14px;align-items:stretch;position:relative;min-height:0}",
    ".ko-tr+.ko-tr:before{content:'';position:absolute;left:calc(150px + 14px + (100% - 164px)/2);top:-9px;height:9px;border-left:2px solid #b4c7e7}",
    ".ko-tl{display:flex;align-items:center;gap:9px;background:#1f3864;color:#fff;border-radius:8px;padding:0 12px;font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;line-height:1.2}",
    ".ko-tl em{font-style:normal;display:flex;width:22px;height:22px;flex:none;border-radius:50%;background:rgba(255,255,255,.22);align-items:center;justify-content:center;font-size:11px}",
    ".ko-tr.t1 .ko-tl{background:#2f5597}.ko-tr.t2 .ko-tl{background:#4472c4}.ko-tr.t3 .ko-tl{background:#5b8bd4}.ko-tr.t4 .ko-tl{background:#7f9fd6}",
    ".ko-tn{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:8px 10px;background:#f7f9fc;border:1px solid #e1e8f2;border-radius:8px;padding:6px 10px;overflow:hidden}",
    ".ko-on{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #d6e0ef;border-left:4px solid #1f3864;border-radius:7px;padding:5px 10px 5px 6px;width:190px;min-width:0;box-shadow:0 1px 3px rgba(0,0,0,.06)}",
    ".ko-on.hmc{border-left-color:#ed7d31;border-color:#f6d3bb}.ko-on span{display:flex;width:28px;height:28px;flex:none;border-radius:50%;background:#1f3864;color:#fff;font-size:11px;font-weight:700;align-items:center;justify-content:center}.ko-on.hmc span{background:#ed7d31}",
    ".ko-on div{min-width:0}.ko-on b{display:block;font-size:11px;color:#1b2433;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ko-on i{display:block;font-size:9.5px;color:#5b6b85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".ko-on.hmc i{color:#c55a11}.ko-on.tbd{border:1px dashed #b4c7e7;background:transparent;box-shadow:none;justify-content:center}.ko-on.tbd b{color:#8a99b3;font-weight:500;font-style:italic}",
    ".ko-sep{width:1px;align-self:stretch;background:#d6e0ef;margin:0 4px}",
    ".ko-tr.dense .ko-on{width:150px;padding:3px 8px 3px 5px}.ko-tr.dense .ko-on span{width:22px;height:22px;font-size:10px}",
    ".ko-team{display:grid;grid-template-columns:1fr 1fr;gap:20px;height:420px}.ko-team.full{grid-template-columns:1fr}",
    ".ko-side{background:#f9f9f9;border:1px solid #e7e7e7;border-radius:8px;padding:10px 20px;box-shadow:0 2px 6px rgba(0,0,0,.06)}.ko-side h4{margin:0 0 10px;font-size:12px;letter-spacing:1px;color:#1f3864}",
    ".ko-side.hmc h4{color:#c55a11}.ko-ppl{display:grid;grid-template-columns:1fr 1fr;gap:10px 18px}.full .ko-ppl{grid-template-columns:repeat(4,1fr)}",
    ".ko-p{display:flex;gap:9px;align-items:center;border-bottom:1px solid var(--kn);padding-bottom:4px;min-width:0}.hmc .ko-p{border-color:var(--ko)}",
    ".ko-p>span{flex:0 0 38px;height:38px;border-radius:50%;background:var(--kn);border:2px solid #8ea9db;color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;font-size:12px}",
    ".hmc .ko-p>span{background:var(--ko);border-color:var(--ko2)}.ko-p div{min-width:0}.ko-p b,.ko-p i{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ko-p b{font-size:10px}.ko-p i{font-size:8.5px;color:#1f3864}.hmc .ko-p i{color:#c55a11}",
    ".ko-gov{display:grid;grid-template-columns:470px 1fr;gap:40px;height:440px}.ko-tri{position:relative}.ko-trik{font-size:8.5px;font-weight:700;letter-spacing:1px;color:var(--ks)}",
    ".ko-trig{position:absolute;left:63px;top:16px;width:386px;height:380px;background:#b4c7e7;clip-path:polygon(50% 0,100% 100%,0 100%)}",
    ".ko-trig:after{content:\"\";position:absolute;inset:1px;background:#eef2f9;clip-path:polygon(50% 0,100% 100%,0 100%)}",
    ".ko-tier{position:absolute;left:0;width:462px;border-bottom:1px dashed #b4c7e7;text-align:center;padding-left:40px}.ko-tier em{position:absolute;left:0;bottom:4px;font-style:normal;font-weight:700;font-size:14px;color:var(--kb2)}",
    ".ko-tier b{display:block;font-size:11.5px;color:var(--kn)}.ko-tier small{display:block;font-size:9px;color:var(--kg);margin-bottom:6px}.ko-tier.t0{top:90px}.ko-tier.t1{top:190px}.ko-tier.t2{top:300px}",
    ".ko-govr p{margin:0 0 14px;font-size:12px}.ko-govr h5{margin:0 0 4px;font-size:11px;color:var(--kb2)}.ko-govr h5+div{font-size:12px;margin-bottom:22px}",
    ".ko-gb{display:grid;grid-template-columns:1fr 1fr;gap:12px}.ko-gb>div{background:#fff;border:1px solid #e7e7e7;border-radius:8px;padding:10px 12px;box-shadow:0 2px 6px rgba(0,0,0,.06)}.ko-gb b{font-size:10.5px;color:var(--kn)}.ko-gb ul{margin:4px 0 0;padding-left:14px;font-size:10px;color:var(--kg)}",
    ".ko-gantt{font-size:8.5px;margin-top:-20px}.ko-gr{display:grid;grid-template-columns:215px 72px 72px 59px 50px 59px 1fr;align-items:center;min-height:23px}.ko-gr:nth-child(odd):not(.hd):not(.ft){background:#f2f2f2}",
    ".ko-gr>div{padding:0 6px;text-align:center}.ko-gr>div:first-child{text-align:left}.ko-gr.gl>div:first-child{font-weight:700}.ko-gr .op{color:var(--kb2)}",
    ".ko-gr.hd{background:var(--kn);color:#fff;font-weight:700;height:35px}.ko-gg{position:relative;align-self:stretch;padding:0!important}",
    ".ko-gr.hd .ko-gg span{position:absolute;top:0;bottom:0;display:flex;align-items:center;justify-content:center;font-weight:400;color:#d6dce5;font-size:8px}",
    ".ko-gg i{position:absolute;top:0;bottom:0;border-left:1px solid #e7e7e7}.ko-gg .bar{position:absolute;top:50%;height:12px;margin-top:-6px;background:var(--kb)}.ko-gg .bar.hc{background:#a5a5a5}",
    ".ko-gg .dia{position:absolute;top:50%;width:13px;height:13px;margin:-6.5px 0 0 -6.5px;background:var(--kb);transform:rotate(45deg)}",
    ".ko-gg .kx{position:absolute;top:0;bottom:0;width:2px;margin-left:-1px;background:var(--kr)}.ko-gr.ft .ko-gg b{position:absolute;top:2px;transform:translateX(-50%);color:var(--kr);font-size:8px}",
    ".ko-ksf{position:absolute;inset:0}.ko-ksfi{position:absolute;left:0;top:0;width:302px;height:432px;background:center/cover}.ko-ksf .ko-obj{left:350px;top:0}.ko-ksf .ko-obj li{height:84px;font-size:14px}",
    ".ko-cal{display:grid;grid-template-columns:repeat(5,1fr) .55fr .55fr;height:450px;margin-top:-14px;border-left:1px solid var(--kl);border-top:1px solid var(--kl)}",
    ".ko-cal>div{border-right:1px solid var(--kl);border-bottom:1px solid var(--kl);background:#fff;padding:3px 5px;font-size:8px;overflow:hidden;position:relative}.ko-cal>div.we{background:#f2f2f2}",
    ".ko-cal .h{background:var(--kn)!important;color:#fff;font-weight:700;text-align:center;font-size:9.5px;padding:9px 0}.ko-cal .h.we{background:#44546a!important}",
    ".ko-cal em{display:block;text-align:right;font-style:normal;color:var(--ks);font-size:9px}.ko-cal span{display:block;font-weight:700;line-height:1.3;color:var(--kb2)}.ko-cal .chg{color:var(--ko)}.ko-cal .done,.ko-cal .ko{color:var(--kr)}",
    ".ko-ns{margin-top:-10px}.ko-ns td{height:34px}.ko-risk{margin-top:-20px;font-size:9.5px}.ko-risk td{height:38px;padding:3px 6px}.lv.Low{color:#70ad47}.lv.Medium{color:#ffc000}.lv.High{color:var(--kr)}",
    ".ko-rr{position:absolute;left:-50px;right:0;top:-12px;bottom:0;display:grid;grid-template-columns:311px 1fr;gap:42px}.ko-rri{background:center/cover}",
    ".ko-rr h5{margin:0;font-size:11.5px;color:var(--kb2)}.ko-rr p{margin:0 0 12px;font-size:10.5px;line-height:1.4}",
    ".ko-doc td{height:38px}.ko-sys{width:calc(100% - 170px);margin:20px 85px 0;font-size:12px}.ko-sys td{height:62px;padding:5px 12px}",
    ".ko-end{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:180px}.ko-end h1{margin:0;font-size:28px;letter-spacing:3px;color:var(--kb2)}.ko-end p{margin:6px 0 0;font-size:13px;color:var(--kg)}",
    "@media print{.kos{box-shadow:none;margin:0 auto;zoom:.94}}",
    ".ch-ph{display:inline-block;margin-left:6px;padding:1px 6px;border-radius:3px;background:#fff4e5;color:#b45309;font-size:9px;font-style:normal;font-weight:600}",
    ".ch-st{display:inline-block;padding:2px 9px;border-radius:10px;font-size:10px;font-weight:700;letter-spacing:.5px;color:#fff;background:#e0a100;vertical-align:1px}.ch-st.fa{background:var(--kb)}.ch-st.ok{background:#2e9e6b}",
    ".ch-ul{margin:0;padding-left:13px}.ch-ul li{margin-bottom:2px}.ch-ul em{font-style:normal;color:var(--kb2);font-weight:600}",
    ".ch-canvas{position:absolute;inset:-12px 0 -8px;display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:1fr 1fr 1fr 44px;gap:7px}",
    ".ch-tile{background:#fff;border:1px solid #e7e7e7;border-left:4px solid var(--kb);border-radius:6px;padding:6px 9px;font-size:8.6px;line-height:1.35;overflow:hidden}",
    ".ch-tile.w2{grid-column:span 2}.ch-k{font-size:8px;color:var(--ks);letter-spacing:.5px;margin-bottom:3px;text-transform:uppercase}.ch-k b{color:var(--kn);font-size:9.5px;letter-spacing:1.5px;margin-right:6px}",
    ".ch-tile.why,.ch-tile.what,.ch-tile.done{border-left-color:var(--kn)}.ch-tile.in,.ch-tile.del,.ch-tile.when{border-left-color:var(--kb)}.ch-tile.out{border-left-color:#a5a5a5}",
    ".ch-tile.cost,.ch-tile.who{border-left-color:var(--ko)}.ch-tile.risk{border-left-color:var(--kr)}.ch-tile.ifc{border-left-color:#e0a100}",
    ".ch-clamp{display:-webkit-box;-webkit-line-clamp:7;-webkit-box-orient:vertical;overflow:hidden}",
    ".ch-sign{grid-column:1/-1;display:grid;grid-template-columns:repeat(4,1fr);gap:16px;align-items:end;background:#eef2f9;border-radius:6px;padding:4px 14px 5px}",
    ".ch-sign div{display:flex;flex-direction:column;font-size:8px;color:var(--kg)}.ch-sign i{border-bottom:1px solid #8c8c8c;height:14px;margin-bottom:2px}.ch-sign b{font-size:9px;color:var(--ki)}",
    ".ch-lv{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:2px;background:#ffc000}.ch-lv.High{background:var(--kr)}.ch-lv.Low{background:#70ad47}",
    ".ch-2{display:grid;grid-template-columns:1.15fr 1fr;gap:40px}.ch-quote{background:var(--kn);color:#fff;border-radius:10px;padding:16px 20px;font-size:15px;line-height:1.45;font-weight:600}",
    ".ch-quote small{display:block;font-size:9px;letter-spacing:1.5px;color:#8fb4e8;margin-bottom:6px}.ch-h{margin:16px 0 6px;font-size:11px;letter-spacing:1px;color:var(--kb2)}.ch-p{margin:0;font-size:12px;line-height:1.55}",
    ".ch-ben{display:grid;grid-template-columns:1fr;gap:9px}.ch-ben div{display:flex;align-items:center;gap:12px;font-size:12.5px;font-weight:600}.ch-ben .ko-sq{width:28px;height:28px;font-size:11px}",
    ".ch-smart i{font-style:normal;color:var(--kb);font-size:13px}",
    ".ch-obj td,.ch-suc td{height:30px}.ch-obj .tg{color:var(--kb2);font-weight:700}.ko-t .ok{color:#2e9e6b;font-weight:700}",
    ".ch-scope{display:grid;grid-template-columns:1.5fr 1fr;gap:22px;height:440px}.ch-in,.ch-out{border-radius:10px;padding:14px 18px;background:#fff;border:1px solid #e7e7e7;box-shadow:0 2px 6px rgba(0,0,0,.06)}",
    ".ch-in h4,.ch-out h4{margin:0 0 10px;font-size:13px;letter-spacing:1px;color:#2e9e6b}.ch-out h4{color:var(--kr)}.ch-ph1{margin-bottom:14px}.ch-ph1>b{font-size:12px;color:var(--kn)}.ch-ph1 small{color:var(--ks)}",
    ".ch-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}.ch-chips span{background:#e9eef8;color:var(--kb2);border-radius:12px;padding:3px 10px;font-size:10px;font-weight:600}",
    ".ch-int{font-size:9.5px;color:var(--kg);margin-top:6px}.ch-x{list-style:none;padding:0;margin:0;font-size:11px}.ch-x li{padding:6px 0 6px 20px;border-bottom:1px dashed #e7e7e7;position:relative}.ch-x li:before{content:\"✕\";position:absolute;left:2px;color:var(--kr);font-weight:700}",
    ".ch-del td{height:33px}",
    ".ch-mls{display:flex;flex-direction:column;gap:26px;padding-top:6px}.ch-mlh{font-size:11px;color:var(--kg)}.ch-mlh b{color:var(--kn);font-size:13px;margin-right:6px}",
    ".ch-line{position:relative;height:150px}.ch-line>i{position:absolute;left:2%;right:2%;top:74px;height:4px;background:linear-gradient(90deg,var(--kb),var(--kn));border-radius:2px}",
    ".ch-pt{position:absolute;top:0;width:150px;margin-left:-75px;text-align:center;height:76px;display:flex;flex-direction:column;justify-content:flex-start}",
    ".ch-pt span{position:absolute;left:69px;top:69px;width:13px;height:13px;background:#fff;border:3px solid var(--kb);transform:rotate(45deg)}.ch-pt.gl span{background:var(--ko);border-color:var(--ko)}",
    ".ch-pt b{font-size:10.5px;color:var(--ki);margin-top:22px}.ch-pt em{font-style:normal;font-size:10px;color:var(--kb2);font-weight:700}",
    ".ch-pt.dn{top:76px;justify-content:flex-start}.ch-pt.dn span{top:-7px}.ch-pt.dn b{margin-top:16px}",
    ".ch-bud{display:grid;grid-template-columns:270px 1fr;gap:24px}.ch-big{background:var(--kn);color:#fff;border-radius:10px;padding:12px 16px;font-size:22px;font-weight:700;margin-bottom:10px}",
    ".ch-big small{display:block;font-size:8.5px;letter-spacing:1.5px;color:#8fb4e8;font-weight:600}.ch-big em{font-style:normal;font-size:12px;color:#8fb4e8}.ch-big.s{background:#eef2f9;color:var(--kn);font-size:14px}.ch-big.s small{color:var(--ks)}",
    ".ch-note{font-size:10px;color:var(--kg);line-height:1.5}.ch-bt{font-size:9.5px}.ch-bt td{padding:5px 7px}.ch-bt .pct{color:var(--kb2);font-weight:700}.ko-t .r{text-align:right}",
    ".ch-pi{position:relative;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:8px;height:445px;margin:-14px 0 0 26px}",
    ".ch-ax{position:absolute;font-size:9px;font-weight:700;letter-spacing:2px;color:var(--ks)}.ch-ax.y{left:-30px;top:50%;transform:rotate(-90deg) translateX(50%);transform-origin:left}.ch-ax.x{bottom:-16px;right:0}",
    ".ch-q{border-radius:8px;padding:10px 14px;background:#f2f5fa;border:1px solid #e3e8f0}.ch-q.mcl{background:#e5edfb;border-color:#b4c7e7}.ch-q h5{margin:0;font-size:13px;color:var(--kn)}.ch-q>small{font-size:9px;color:var(--ks)}",
    ".ch-q .ch-chips span{background:var(--kn);color:#fff}.ch-q .ch-chips span.h{background:var(--ko)}.ch-q .ch-chips span.t{background:#7f7f7f}.ch-q .ch-chips em{font-style:normal;opacity:.75;font-weight:400;font-size:8.5px}",
    ".ch-raci td{height:30px}.ch-raci th{font-size:9.5px}.ko-t td.rc{font-weight:700;font-size:11px}.rc.R{background:#dbe7fb;color:var(--kb2)}.rc.A{background:var(--kn);color:#fff}.rc.C{background:#fff1dc;color:#c55a11}.rc.I{color:var(--ks)}",
    ".ch-rk{display:flex;gap:22px;justify-content:center;margin-top:12px;font-size:10px;color:var(--kg)}.ch-rk i{display:inline-block;width:20px;height:20px;line-height:20px;text-align:center;font-style:normal;font-weight:700;border-radius:3px;margin-right:6px}.ch-rk b{color:var(--ki)}",
    ".ch-rac{display:grid;grid-template-columns:1.6fr 1fr;gap:26px}.ch-risk td{height:38px;font-size:9.5px}.ch-rac .ch-h:first-child{margin-top:0}.ch-rac .ch-ul{font-size:10.5px}.ch-rac .ch-ul li{margin-bottom:5px}",
    ".ch-gov{display:grid;grid-template-columns:1fr 1.25fr;gap:28px}.ch-esc{display:flex;flex-direction:column-reverse;gap:4px}.ch-esc>div{border-radius:8px;padding:10px 14px;color:#fff}.ch-esc .l0{background:#6f95d8}.ch-esc .l1{background:var(--kb2)}.ch-esc .l2{background:var(--kn)}",
    ".ch-esc b{display:block;font-size:12.5px}.ch-esc span{font-size:10px;opacity:.9}.ch-esc em{display:block;font-style:normal;font-size:9.5px;color:#d6e2f5;margin-top:2px}.ch-esc>i{font-style:normal;font-size:9px;color:var(--ks);text-align:center;letter-spacing:1px}",
    ".ch-auth td{height:46px;font-size:10px}",
    ".ch-auth-p{margin:0 0 20px;font-size:12.5px;line-height:1.55;color:var(--kg);max-width:900px}.ch-sigs{display:grid;grid-template-columns:1fr 1fr;gap:20px 40px}",
    ".ch-sigs>div{min-height:150px;align-content:start;background:#fff;border:1px solid #e7e7e7;border-radius:8px;padding:16px 22px;display:grid;grid-template-columns:1fr 1fr;column-gap:16px}.ch-sigs small{grid-column:1/-1;font-size:8.5px;letter-spacing:1px;color:var(--ks);text-transform:uppercase}",
    ".ch-sigs b{grid-column:1/-1;font-size:15px}.ch-sigs span{grid-column:1/-1;font-size:11px;color:var(--kb2);margin-bottom:46px}.ch-sigs i{font-style:normal;font-size:8.5px;color:var(--ks);border-top:1px solid #8c8c8c;padding-top:2px}",
    ".st-pill{display:inline-block;padding:2px 10px;border-radius:10px;color:#fff;font-size:10px;font-weight:700;letter-spacing:.3px;white-space:nowrap}",
    ".st-dot{display:inline-block;width:11px;height:11px;border-radius:50%;flex:0 0 11px}",
    ".st-imp{display:inline-block;min-width:18px;text-align:center;background:var(--kn);color:#fff;font-size:9px;font-weight:700;border-radius:3px;padding:1px 4px;margin:0 2px}",
    ".st-no{display:inline-flex;align-items:center;justify-content:center;width:28px;height:22px;border-radius:4px;background:var(--kr);color:#fff;font-weight:700;font-size:11px}.st-no.a{background:#e0a100;flex:0 0 28px}",
    ".st-dash{position:absolute;inset:-14px 0 0;display:grid;grid-template-columns:300px 1fr;grid-template-rows:auto auto 1fr;gap:10px 14px}",
    ".st-ov{grid-row:span 2;border-radius:10px;color:#fff;padding:14px 18px}.st-ov small{font-size:9px;letter-spacing:1.5px;opacity:.85}.st-ov>b{display:block;font-size:30px;line-height:1.2;margin:2px 0 8px}",
    ".st-pg{display:flex;justify-content:space-between;font-size:11px}.st-bar{position:relative;height:10px;border-radius:5px;background:rgba(255,255,255,.3);margin:5px 0 10px}.st-bar i{position:absolute;left:0;top:0;bottom:0;border-radius:5px;background:#fff}",
    ".st-bar em{position:absolute;top:-3px;bottom:-3px;width:2px;background:#13284c}.st-ov .st-bar em{background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.25)}.st-gl{font-size:11px;opacity:.95}.st-gl b{font-size:18px}",
    ".st-bar.s{background:#e7ebf1;height:8px;margin:0}.st-bar.s i{background:var(--kb)}",
    ".st-dims{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.st-dim{background:#fff;border:1px solid #e7e7e7;border-top:4px solid #ccc;border-radius:8px;padding:9px 12px;display:flex;flex-direction:column;gap:5px;align-items:flex-start}",
    ".st-dim small{font-size:9.5px;font-weight:700;letter-spacing:1.5px;color:var(--kn)}.st-dim span:last-child{font-size:10px;color:var(--kg)}",
    ".st-rat{background:#fff;border:1px solid #e7e7e7;border-left:4px solid var(--kb);border-radius:8px;padding:8px 12px;font-size:10.5px;line-height:1.45;max-height:96px;overflow:hidden}.st-rat small,.st-ph small{display:block;font-size:8.5px;letter-spacing:1.5px;color:var(--ks);margin-bottom:3px}",
    ".st-ph{grid-column:1/-1;background:#fff;border:1px solid #e7e7e7;border-radius:8px;padding:8px 14px;display:grid;grid-template-columns:1fr 1fr;column-gap:30px;align-content:start}.st-ph small{grid-column:1/-1}",
    ".st-pr{display:grid;grid-template-columns:200px 1fr 38px;align-items:center;gap:8px;font-size:9.5px;height:19px}.st-pr span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.st-pr b{text-align:right}",
    ".st-decs{display:grid;grid-template-columns:1fr 1fr;gap:14px}.st-dec{background:#fff;border:1px solid #e7e7e7;border-left:5px solid var(--kr);border-radius:8px;padding:12px 16px;display:flex;flex-direction:column;gap:6px;min-height:200px}",
    ".st-dh{display:flex;align-items:center;gap:6px}.st-dh em{margin-left:auto;font-style:normal;font-size:10px;color:var(--kb2);font-weight:600}.st-dec>b{font-size:13px;line-height:1.35}.st-ask{margin:0;font-size:11.5px;line-height:1.5;color:var(--kg);flex:1}",
    ".st-res{display:flex;gap:12px;flex-wrap:wrap;border-top:1px dashed #d9d9d9;padding-top:7px;font-size:10px;color:var(--kn);font-weight:600}",
    ".st-acks{display:flex;flex-direction:column;gap:9px}.st-ack{display:grid;grid-template-columns:11px 28px 1fr 170px;gap:12px;align-items:center;background:#fff;border:1px solid #e7e7e7;border-radius:8px;padding:9px 14px}",
    ".st-ack b{font-size:12px}.st-ack p{margin:3px 0 0;font-size:10.5px;color:var(--kg);line-height:1.45}.st-ow{text-align:right}.st-ow em{display:block;font-style:normal;font-size:10px;color:var(--kb2);font-weight:600;margin-top:3px}",
    ".st-none{display:flex;align-items:center;justify-content:center;height:300px;border:2px dashed #d9d9d9;border-radius:10px;color:var(--ks);font-size:15px}.st-none.s{height:auto;padding:16px;font-size:11px}",
    ".st-ms td{height:32px}.st-ms td:nth-child(4){width:300px}.st-ms .st-bar{width:210px;display:inline-block;vertical-align:middle}.st-pc{font-size:9px;color:var(--kg);margin-left:8px}",
    ".st-ri td{height:52px;font-size:10px}.st-ri .tag{font-size:8.5px;background:#e9eef8;color:var(--kb2);padding:1px 6px;border-radius:3px;font-weight:700;white-space:nowrap}",
    ".st-pay{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.st-fee{background:#fff;border:1px solid #e7e7e7;border-radius:10px;padding:12px 16px;display:flex;flex-direction:column;gap:7px}",
    ".st-fh b{display:block;font-size:12.5px;color:var(--kn)}.st-fh span{font-size:11px;color:var(--kg)}.st-fee .st-pr{grid-template-columns:96px 1fr 36px}",
    ".st-inst{display:flex;flex-direction:column;gap:4px;margin-top:6px}.st-inst span{font-size:9.5px;padding:3px 8px;border-radius:4px;background:#f2f2f2;color:var(--kg)}",
    ".st-inst .s-done{background:#e3ecfb;color:#1b4f8f}.st-inst .s-ok{background:#e3f4ec;color:#1d7a4f}.st-inst .s-risk{background:#fff4d6;color:#8a6200}.st-inst .s-late{background:#fde8e8;color:#9b1c1c}",
    ".st-next{display:grid;grid-template-columns:1fr 1.5fr;gap:26px}.st-nm{display:grid;grid-template-columns:11px 1fr;column-gap:10px;align-items:center;background:#fff;border:1px solid #e7e7e7;border-radius:8px;padding:9px 12px;margin-bottom:8px}",
    ".st-nm b{font-size:12px}.st-nm span{grid-column:2;font-size:10px;color:var(--kb2);font-weight:600}.st-ac td{height:34px;font-size:10px}.st-ac td.o-client{color:#c55a11;font-weight:700}",
    ".dcs .ko-body{display:flex;flex-direction:column}.dc-t td.dc-ok{color:#2e9e6b;font-size:15px}.dc-t td.dc-no{color:#94a3b8;font-size:15px}.dc-t td.dc-au{color:#2f6fde}.dc-t td.dc-na{color:#cbd5e1}.dc-t td.dc-late{color:#d64545;font-weight:600}.dc-t td,.dc-t th{padding:4px 8px;font-size:11.5px}",
    ".dc-note{margin-top:10px;font-size:11px;color:#475569;background:#f1f6fd;border-left:4px solid var(--kb);padding:6px 10px;border-radius:4px}.dc-empty{color:#94a3b8;font-size:12px;padding:6px 0}",
    ".dc-g{display:grid;grid-template-columns:1fr 1fr;gap:12px}.dc-box{background:#fff;border:1px solid #e7e7e7;border-top:4px solid var(--kb);border-radius:8px;padding:8px 12px;min-height:150px}.dc-box.hot{border-top-color:#d64545}.dc-box h5{margin:0 0 4px;font-size:11.5px;letter-spacing:.5px;color:var(--kb)}.dc-box .ch-ul{font-size:11.5px;margin:0;padding-left:16px}.dc-box em{color:#64748b;font-style:normal}",
    ".dc-raidd{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:12px}.dc-raidd>div{background:#fff;border:1px solid #e7e7e7;border-radius:8px;padding:6px 12px;display:flex;align-items:baseline;gap:8px}.dc-raidd b{font-size:22px;color:var(--kb)}.dc-raidd span{font-weight:600;font-size:12px}.dc-raidd em{margin-left:auto;font-size:10.5px;color:#94a3b8;font-style:normal}",
    ".dc-two{display:grid;grid-template-columns:1.45fr 1fr;gap:14px}",
    ".ax-g .dc-t td,.ax-g .dc-t th{padding:1.5px 6px;font-size:10.5px;line-height:1.3}.ax-g{display:grid;grid-template-columns:1fr 1.25fr;gap:16px}.ax-tot{display:flex;align-items:baseline;gap:10px;margin-bottom:8px}.ax-tot b{font-size:34px;color:var(--kb)}.ax-tot span{font-size:12px;color:#475569}",
    ".ax-m{display:grid;grid-template-columns:1.3fr 1fr auto;gap:8px;align-items:center;font-size:11.5px;margin:5px 0}.ax-bar{height:8px;background:#e7edf5;border-radius:4px;overflow:hidden}.ax-bar i{display:block;height:100%}",
    ".ax-m em{font-style:normal}.ax-m em.e{color:#d64545}.ax-m em.w{color:#b45309}.ax-top{margin-top:10px;background:#fff;border:1px solid #e7e7e7;border-top:4px solid #d64545;border-radius:8px;padding:6px 10px}.ax-top h5{margin:0 0 4px;font-size:11px;color:#d64545}.ax-top ul{font-size:10.5px;margin:0}",
    ".cr-k{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:-14px 0 14px}.cr-k>div{background:#fff;border:1px solid #e7e7e7;border-top:4px solid var(--kb);border-radius:8px;padding:9px 14px}.cr-k>div.hot{border-top-color:#e0a100}",
    ".cr-k small{display:block;font-size:8.5px;letter-spacing:1.4px;color:var(--ks)}.cr-k b{display:block;font-size:24px;color:var(--kn);line-height:1.25}.cr-k span{font-size:10px;color:var(--kg)}",
    ".crs h2{right:50px;font-size:21px;letter-spacing:1.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cr-t td{height:34px;font-size:10px}.cr-t .urg{color:var(--kr);font-weight:700}.cr-t .stg{color:#b45309;font-weight:700}.cr-w{color:#b45309;font-weight:700}.cr-ok{color:#2e9e6b;font-weight:700}",
    ".cr-g{position:absolute;inset:-18px 0 0;display:grid;grid-template-columns:1.25fr 1fr;gap:16px}.cr-d{background:#fff;border:1px solid #e7e7e7;border-radius:8px;padding:10px 16px;overflow:hidden}",
    ".cr-g h5{margin:6px 0 2px;font-size:9px;letter-spacing:1.4px;color:var(--kb2)}.cr-d p{margin:0 0 6px;font-size:10.5px;line-height:1.45}.cr-d .ch-chips span{font-size:9px}",
    ".cr-r{display:flex;flex-direction:column;gap:8px;min-height:0}.cr-box{background:#fff;border:1px solid #e7e7e7;border-radius:8px;padding:6px 14px 8px}.cr-box h5{margin-top:2px}",
    ".cr-e{display:grid;grid-template-columns:52px 1fr 30px;gap:8px;align-items:center;font-size:9.5px;height:16px}.cr-e div{height:8px;background:#e7ebf1;border-radius:4px}.cr-e i{display:block;height:100%;background:var(--kb);border-radius:4px}.cr-e b{text-align:right}",
    ".cr-tot{display:flex;justify-content:space-between;border-top:1px dashed #d9d9d9;margin-top:4px;padding-top:4px;font-size:10.5px}.cr-tot b{font-size:15px;color:var(--kn)}",
    ".cr-lv{margin-top:4px;font-size:9.5px;font-weight:700;color:#2e9e6b}.cr-lv.stg{color:#b45309}",
    ".cr-m{display:grid;grid-template-columns:1fr 62px 72px;gap:6px;font-size:9px;line-height:1.55}.cr-m em{font-style:normal;color:var(--ks)}.cr-m b{text-align:right;color:var(--kb2)}.cr-m.na b{color:var(--ks);font-weight:400}",
    ".cr-box.chk{flex:1;overflow:hidden}.cr-c{font-size:9.5px;line-height:1.4;margin-bottom:3px}.cr-c.warn{color:#b45309;font-weight:600}.cr-c.ok{color:#1d7a4f}.cr-c.info{color:var(--kg)}",
    "@media print{body{background:#fff!important;padding:0!important}.page{box-shadow:none;margin:0;min-height:0;width:auto;padding:0 18px 10px;gap:12px;zoom:var(--fit,1)}.rh{margin:0 -18px;padding:14px 18px}.noprint{display:none!important}tr,.tl-row,.card li,.la-r{break-inside:avoid}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}"
,
    ".rh-rr{display:flex;flex-direction:column;align-items:flex-end;gap:7px}.rh-logos{display:flex;align-items:center;gap:16px}" +
    ".clogo-box{display:flex;align-items:center;justify-content:center;background:#fff;border-radius:7px;padding:5px 12px;height:46px}.clogo-box img{max-height:36px;max-width:150px;display:block}" +
    ".hlogo.r{padding:0 0 0 16px;border-right:0;border-left:1px solid rgba(255,255,255,.25);height:22px}.rh-logos .hlogo.r:first-child{padding-left:0;border-left:0}" +
    ".rh-pm{font-size:11.5px;color:#b9cbe4;white-space:nowrap}.rh-pm b{color:#fff;font-weight:600}.rh-pm .badge{margin-right:8px}" +
    ".page.cover{background:linear-gradient(115deg,#0f2a4a 0%,#163a66 62%,#1b4f8f 100%);color:#fff;padding:44px 60px;justify-content:space-between;gap:0}" +
    ".cv-top{display:flex;justify-content:space-between;align-items:center}.cv-top .clogo-box{height:70px;padding:8px 18px}.cv-top .clogo-box img{max-height:54px;max-width:200px}.cv-top .hlogo.r{height:30px}" +
    ".cv-mid h1{margin:0 0 10px;font-size:54px;font-weight:700;letter-spacing:-.01em;color:#fff}.cv-client{font-size:24px;font-weight:700;color:#fff}.cv-date{font-size:24px;color:#b9cbe4;margin-top:4px}" +
    ".cv-bot{display:flex;justify-content:space-between;align-items:flex-end;gap:24px}.cv-k{font-size:12px;font-weight:700;letter-spacing:.22em;color:#8fb4e8;margin-bottom:10px}" +
    ".cv-row{display:flex;align-items:center;gap:28px}.cv-st{display:inline-block;min-width:200px;text-align:center;padding:12px 26px;border-radius:14px;font-size:24px;font-weight:700;color:#fff}" +
    ".cv-prog{font-size:22px;color:#8fb4e8}.cv-prog b{color:#fff}.cv-pm{font-size:18px;color:#8fb4e8}.cv-pm b{color:#fff;font-weight:600}"
  ].join("\n");

  var FIT_JS = "function psrFit(){var P=document.querySelectorAll('.psr .page');for(var i=0;i<P.length;i++){var p=P[i];p.style.removeProperty('--fit');" +
    "var mh=p.style.minHeight;p.style.minHeight='0';var h=p.offsetHeight;p.style.minHeight=mh;var s=Math.min(1,700/h);" +
    "p.style.setProperty('--fit',s<0.55?1:s.toFixed(3));}}window.addEventListener('beforeprint',psrFit);";
  function fullDocument(M, mode, assets) {
    if (mode === "docs") return '<!DOCTYPE html><html lang="' + LANG + '"><head><meta charset="utf-8">' + FONT_LINK + '<title>' + esc(M.P.short + " – Project Documents " + fmtD(M.P.rd)) +
      "</title><style>body{margin:0;padding:24px 0;background:#e9edf2}" + CSS + "</style></head><body>" + trHTML(renderDocs(M, assets)) + "</body></html>";
    if (mode === "cr") return '<!DOCTYPE html><html lang="' + LANG + '"><head><meta charset="utf-8">' + FONT_LINK + '<title>' + esc(M.P.short + " – Change Requests " + fmtD(M.P.rd)) +
      "</title><style>body{margin:0;padding:24px 0;background:#e9edf2}" + CSS + "</style></head><body>" + trHTML(renderCR(M, assets)) + "</body></html>";
    if (mode === "steering") return '<!DOCTYPE html><html lang="' + LANG + '"><head><meta charset="utf-8">' + FONT_LINK + '<title>' + esc(M.P.short + " – Steering Committee " + fmtD(M.P.rd)) +
      "</title><style>body{margin:0;padding:24px 0;background:#e9edf2}" + CSS + "</style></head><body>" + trHTML(renderSteering(M, assets)) + "</body></html>";
    if (mode === "charter") return '<!DOCTYPE html><html lang="' + LANG + '"><head><meta charset="utf-8">' + FONT_LINK + '<title>' + esc(M.P.short + " – Project Charter") +
      "</title><style>body{margin:0;padding:24px 0;background:#e9edf2}" + CSS + "</style></head><body>" + trHTML(renderCharter(M, assets)) + "</body></html>";
    if (mode === "kickoff") return '<!DOCTYPE html><html lang="' + LANG + '"><head><meta charset="utf-8">' + FONT_LINK + '<title>' + esc(M.P.short + " – Kick-off Plan") +
      "</title><style>body{margin:0;padding:24px 0;background:#e9edf2}" + CSS + "</style></head><body>" + trHTML(renderKickoff(M, assets)) + "<script>" + FIT_JS + "psrFit();<\/script></body></html>";
    return '<!DOCTYPE html><html lang="' + LANG + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' + FONT_LINK + '<title>' +
      esc(M.P.short + " – " + M.P.title + " (" + (mode === "internal" ? "Internal" : "External") + ") " + fmtD(M.P.rd)) +
      "</title><style>body{margin:0;padding:24px 0;background:#e9edf2}" + CSS + "</style></head><body>" + renderReport(M, mode) +
      "<script>" + FIT_JS + "psrFit();<\/script></body></html>";
  }
  function fileName(M, mode) {
    var cm = mode === "charter" ? charterModel(M) : null;
    var d = new Date(cm ? cm.date : mode === "kickoff" && M.kickoff && M.kickoff.kickoff != null ? M.kickoff.kickoff : M.P.rd);
    var ymd = d.getUTCFullYear() + ("0" + (d.getUTCMonth() + 1)).slice(-2) + ("0" + d.getUTCDate()).slice(-2);
    return (M.P.short || "Project").replace(/[^\w\-]+/g, "_") + (mode === "charter" ? "_Charter_" : mode === "steering" ? "_Steering_" : mode === "cr" ? "_Change_Requests_" : mode === "docs" ? "_Project_Documents_" : mode === "kickoff" ? "_Kickoff_" : "_Status_" + (mode === "internal" ? "Internal" : "External") + "_") + ymd + ".html";
  }


  // ---------- client logo: the picture placed on sheet "Kickoff" (row "Client Logo") → data URL. Needs JSZip; returns a Promise (null when none).
  function extractLogo(buf, JSZip) {
    if (!JSZip) return Promise.resolve(null);
    var MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", svg: "image/svg+xml", bmp: "image/bmp", webp: "image/webp" };
    var norm = function (base, t) { if (t.charAt(0) === "/") return t.slice(1); var p = base.split("/"); p.pop(); t.split("/").forEach(function (x) { if (x === "..") p.pop(); else if (x !== ".") p.push(x); }); return p.join("/"); };
    var relsOf = function (z, part) { var i = part.lastIndexOf("/"), f = z.file(part.slice(0, i) + "/_rels/" + part.slice(i + 1) + ".rels");
      return f ? f.async("string").then(function (x) { var m = {}, re = /<Relationship\b[^>]*>/g, r;
        while ((r = re.exec(x))) { var id = /Id="([^"]+)"/.exec(r[0]), tg = /Target="([^"]+)"/.exec(r[0]); if (id && tg) m[id[1]] = norm(part, tg[1].replace(/&amp;/g, "&")); } return m; }) : Promise.resolve({}); };
    var toData = function (z, path) { var ext = (path.split(".").pop() || "").toLowerCase(), f = z.file(path);
      if (!f || !MIME[ext]) return Promise.resolve(null); return f.async("base64").then(function (b) { return "data:" + MIME[ext] + ";base64," + b; }); };
    return JSZip.loadAsync(buf).then(function (z) {
      var wbf = z.file("xl/workbook.xml"); if (!wbf) return null;
      return Promise.all([wbf.async("string"), relsOf(z, "xl/workbook.xml")]).then(function (a) {
        var sh = /<sheet\b[^>]*name="Kickoff"[^>]*>/.exec(a[0]), rid = sh && /r:id="([^"]+)"/.exec(sh[0]), sheet = rid && a[1][rid[1]];
        var viaDrawing = !sheet ? Promise.resolve(null) : Promise.all([z.file(sheet) ? z.file(sheet).async("string") : "", relsOf(z, sheet)]).then(function (b) {
          var d = /<drawing\b[^>]*r:id="([^"]+)"/.exec(b[0]), dp = d && b[1][d[1]]; if (!dp || !z.file(dp)) return null;
          return Promise.all([z.file(dp).async("string"), relsOf(z, dp)]).then(function (c) {
            var re = /r:embed="([^"]+)"/g, m, list = []; while ((m = re.exec(c[0]))) if (c[1][m[1]]) list.push(c[1][m[1]]);
            var pick = list.filter(function (p) { return /\.(png|jpe?g|gif|bmp|webp)$/i.test(p); })[0] || list[0];
            return pick ? toData(z, pick) : null;
          });
        });
        return viaDrawing.then(function (r) {
          if (r) return r;   // Excel 365 "Place in Cell" pictures live in richData
          return relsOf(z, "xl/richData/richValueRel.xml").then(function (m) { var k = Object.keys(m)[0]; return k ? toData(z, m[k]) : null; });
        });
      });
    }).catch(function () { return null; });
  }

  var api = { parseWorkbook: parseWorkbook, compute: compute, renderReport: renderReport, fullDocument: fullDocument,
              fileName: fileName, extractLogo: extractLogo, setLang: setLang, lang: lang, tr: tr, CSS: CSS, fmtD: fmtD, FIT_JS: FIT_JS, FONT_LINK: FONT_LINK, FONT_STACK: FONT_STACK,
              _h: { renderDocs: renderDocs, DOC_COL: DOC_COL, BRAND: BRAND, fmtD: fmtD, fmtP: fmtP, short: short, money: money, steerItems: steerItems, ownerClass: ownerClass, planned: planned, MON: MON, DAY: DAY, STATUS: STATUS, KO: KO, CHR: CHR, charterModel: charterModel, steeringModel: steeringModel, SEV: SEV, CRF: CRF, crModel: crModel, docsModel: docsModel, RAIDD_OF: RAIDD_OF, tr: tr, lang: lang, stageName: stageName, enDate: enDate, dShort: dShort } };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.PSR = api;
})(this);
