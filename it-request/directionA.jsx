// Direction A — คลาสสิกองค์กร (Classic enterprise)
// Create-request screen: white cards, labels above fields, blue accent.
(function () {
  const CSS = `
  .a-root{--ink:#1e2430;--muted:#5b6472;--line:#e2e5ea;--bg:#f4f5f7;--card:#fff;
    --accent:oklch(0.52 0.13 252);--accent-soft:oklch(0.96 0.03 252);--accent-line:oklch(0.86 0.06 252);
    font-family:'IBM Plex Sans Thai',sans-serif;color:var(--ink);background:var(--bg);width:100%;min-height:100%;}
  .a-root *{box-sizing:border-box;}
  /* top bar */
  .a-bar{display:flex;align-items:center;gap:16px;height:60px;padding:0 28px;background:var(--card);border-bottom:1px solid var(--line);}
  .a-logo{display:flex;align-items:center;gap:11px;}
  .a-logo .mk{width:30px;height:30px;border-radius:7px;background:var(--accent);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:15px;}
  .a-logo b{font-size:15px;font-weight:600;letter-spacing:-.01em;}
  .a-logo span{font-size:12px;color:var(--muted);margin-left:2px;}
  .a-nav{display:flex;gap:4px;margin-left:18px;}
  .a-nav a{font-size:13.5px;color:var(--muted);padding:7px 13px;border-radius:7px;text-decoration:none;}
  .a-nav a.on{background:var(--accent-soft);color:var(--accent);font-weight:600;}
  .a-user{margin-left:auto;display:flex;align-items:center;gap:10px;font-size:13px;}
  .a-user .av{width:32px;height:32px;border-radius:50%;background:#d8dde4;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;color:#55606e;}
  /* page */
  .a-page{padding:26px 28px 36px;}
  .a-crumb{font-size:12.5px;color:var(--muted);margin-bottom:6px;}
  .a-h1{font-size:23px;font-weight:600;letter-spacing:-.01em;margin:0 0 2px;}
  .a-sub{font-size:13.5px;color:var(--muted);margin:0 0 22px;}
  .a-grid{display:grid;grid-template-columns:1fr 312px;gap:22px;align-items:start;}
  .a-card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:22px 24px;margin-bottom:18px;}
  .a-ct{display:flex;align-items:center;gap:9px;font-size:15px;font-weight:600;margin:0 0 18px;}
  .a-ct .n{width:23px;height:23px;border-radius:6px;background:var(--accent-soft);color:var(--accent);font-size:12.5px;font-weight:700;display:flex;align-items:center;justify-content:center;}
  .a-field{margin-bottom:16px;}
  .a-field:last-child{margin-bottom:0;}
  .a-lbl{display:block;font-size:13px;font-weight:600;margin-bottom:7px;}
  .a-lbl .req{color:#c0392b;margin-left:2px;}
  .a-inp,.a-sel,.a-ta{width:100%;border:1px solid var(--line);border-radius:8px;padding:10px 13px;font:inherit;font-size:14px;color:var(--ink);background:#fff;}
  .a-inp::placeholder,.a-ta::placeholder{color:#9aa3b0;}
  .a-inp:focus,.a-ta:focus,.a-sel:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft);}
  .a-sel{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%235b6472' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center;}
  .a-ta{resize:none;min-height:88px;line-height:1.55;}
  .a-row2{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
  .a-urg{display:flex;gap:9px;}
  .a-urg label{flex:1;border:1px solid var(--line);border-radius:8px;padding:9px 12px;font-size:13.5px;display:flex;align-items:center;gap:8px;cursor:pointer;}
  .a-urg label.on{border-color:var(--accent);background:var(--accent-soft);color:var(--accent);font-weight:600;}
  .a-urg .dot{width:9px;height:9px;border-radius:50%;background:currentColor;opacity:.5;}
  .a-urg label.on .dot{opacity:1;}
  .a-file{border:1.5px dashed var(--accent-line);border-radius:9px;padding:16px;text-align:center;font-size:13px;color:var(--muted);background:var(--accent-soft);}
  .a-file b{color:var(--accent);}
  /* approvers */
  .a-slot{display:flex;align-items:center;gap:13px;padding:13px 0;border-top:1px solid var(--line);}
  .a-slot:first-of-type{border-top:none;padding-top:4px;}
  .a-step{width:26px;height:26px;border-radius:50%;background:#eef0f3;color:var(--muted);font-size:12.5px;font-weight:700;display:flex;align-items:center;justify-content:center;flex:0 0 auto;}
  .a-slotmid{flex:1;min-width:0;}
  .a-slotrole{font-size:12px;color:var(--muted);margin-bottom:3px;}
  .a-slotname{font-size:14px;font-weight:600;display:flex;align-items:center;gap:8px;}
  .a-av{width:28px;height:28px;border-radius:50%;background:#d8dde4;color:#55606e;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;flex:0 0 auto;}
  .a-pick{display:flex;align-items:center;gap:10px;border:1px solid var(--line);border-radius:8px;padding:6px 8px 6px 6px;}
  .a-pick input{border:none;outline:none;font:inherit;font-size:13.5px;flex:1;background:transparent;color:var(--ink);}
  .a-tag{font-size:11px;font-weight:600;padding:3px 9px;border-radius:20px;flex:0 0 auto;}
  .a-tag.fix{background:#eef0f3;color:var(--muted);}
  .a-tag.sel{background:var(--accent-soft);color:var(--accent);}
  .a-tag.opt{background:#fff;color:var(--muted);border:1px solid var(--line);}
  /* signature */
  .a-sigtabs{display:flex;gap:6px;margin-bottom:13px;}
  .a-sigtabs button{font:inherit;font-size:13px;padding:7px 14px;border-radius:7px;border:1px solid var(--line);background:#fff;color:var(--muted);cursor:pointer;}
  .a-sigtabs button.on{border-color:var(--accent);background:var(--accent-soft);color:var(--accent);font-weight:600;}
  .a-sigpad{height:130px;border:1.5px dashed var(--accent-line);border-radius:10px;background:repeating-linear-gradient(135deg,#fafbfc,#fafbfc 9px,#f2f4f6 9px,#f2f4f6 10px);display:flex;align-items:center;justify-content:center;}
  .a-sigpad .ph{font-family:ui-monospace,monospace;font-size:11.5px;color:#9aa3b0;}
  .a-sighint{font-size:12px;color:var(--muted);margin-top:9px;display:flex;justify-content:space-between;}
  .a-sighint a{color:var(--accent);text-decoration:none;}
  /* sidebar */
  .a-side{position:sticky;top:18px;}
  .a-sidecard{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:20px;}
  .a-sidecard h4{font-size:14px;font-weight:600;margin:0 0 14px;}
  .a-srow{display:flex;justify-content:space-between;font-size:13px;padding:8px 0;border-bottom:1px solid var(--line);}
  .a-srow:last-of-type{border-bottom:none;}
  .a-srow .k{color:var(--muted);}
  .a-srow .v{font-weight:600;text-align:right;}
  .a-btn{width:100%;border:none;border-radius:9px;padding:13px;font:inherit;font-size:14.5px;font-weight:600;cursor:pointer;}
  .a-btn.pri{background:var(--accent);color:#fff;margin-top:16px;}
  .a-btn.sec{background:#fff;color:var(--ink);border:1px solid var(--line);margin-top:9px;}
  .a-note{font-size:11.5px;color:var(--muted);line-height:1.5;margin-top:14px;text-align:center;}
  `;
  function Slot({ n, role, name, mode }) {
    const initials = name ? name.trim().slice(0, 1) : '';
    return (
      React.createElement('div', { className: 'a-slot' },
        React.createElement('div', { className: 'a-step' }, n),
        mode === 'fixed'
          ? React.createElement('div', { className: 'a-slotmid' },
              React.createElement('div', { className: 'a-slotrole' }, role),
              React.createElement('div', { className: 'a-slotname' },
                React.createElement('div', { className: 'a-av' }, initials), name))
          : React.createElement('div', { className: 'a-slotmid' },
              React.createElement('div', { className: 'a-slotrole' }, role),
              React.createElement('div', { className: 'a-pick' },
                React.createElement('div', { className: 'a-av' }, name ? initials : '+'),
                React.createElement('input', { defaultValue: name, placeholder: 'ค้นหาชื่อพนักงาน…' }))),
        React.createElement('span', { className: 'a-tag ' + (mode === 'fixed' ? 'fix' : mode === 'opt' ? 'opt' : 'sel') },
          mode === 'fixed' ? 'กำหนดไว้' : mode === 'opt' ? 'เลือกหรือข้ามได้' : 'คุณเลือกเอง')
      )
    );
  }
  function DirectionA() {
    return React.createElement(React.Fragment, null,
      React.createElement('style', null, CSS),
      React.createElement('div', { className: 'a-root' },
        // top bar
        React.createElement('div', { className: 'a-bar' },
          React.createElement('div', { className: 'a-logo' },
            React.createElement('div', { className: 'mk' }, 'IT'),
            React.createElement('b', null, 'ระบบขอใช้งาน IT')),
          React.createElement('nav', { className: 'a-nav' },
            React.createElement('a', { className: 'on' }, 'สร้างคำขอ'),
            React.createElement('a', null, 'คำขอของฉัน'),
            React.createElement('a', null, 'รออนุมัติ')),
          React.createElement('div', { className: 'a-user' },
            React.createElement('div', { className: 'av' }, 'สช'),
            'สมชาย ใจดี')),
        // page
        React.createElement('div', { className: 'a-page' },
          React.createElement('div', { className: 'a-crumb' }, 'หน้าหลัก / คำขอของฉัน / สร้างคำขอ'),
          React.createElement('h1', { className: 'a-h1' }, 'สร้างคำขอใหม่'),
          React.createElement('p', { className: 'a-sub' }, 'กรอกข้อมูล เลือกผู้อนุมัติ แล้วเซ็นรับรอง — ระบบจะส่งอีเมลแจ้งผู้อนุมัติให้อัตโนมัติ'),
          React.createElement('div', { className: 'a-grid' },
            // ── main column ──
            React.createElement('div', null,
              // section 1
              React.createElement('div', { className: 'a-card' },
                React.createElement('h3', { className: 'a-ct' }, React.createElement('span', { className: 'n' }, '1'), 'ข้อมูลคำขอ'),
                React.createElement('div', { className: 'a-row2' },
                  React.createElement('div', { className: 'a-field' },
                    React.createElement('label', { className: 'a-lbl' }, 'ประเภทคำขอ', React.createElement('span', { className: 'req' }, '*')),
                    React.createElement('select', { className: 'a-sel', defaultValue: '1' },
                      React.createElement('option', { value: '1' }, 'ขอติดตั้งโปรแกรม'),
                      React.createElement('option', null, 'ขอสิทธิ์เข้าใช้ระบบ'),
                      React.createElement('option', null, 'แจ้งซ่อมอุปกรณ์'))),
                  React.createElement('div', { className: 'a-field' },
                    React.createElement('label', { className: 'a-lbl' }, 'วันที่ต้องการใช้งาน'),
                    React.createElement('input', { className: 'a-inp', type: 'text', defaultValue: '10 / 06 / 2569' }))),
                React.createElement('div', { className: 'a-field' },
                  React.createElement('label', { className: 'a-lbl' }, 'หัวข้อ', React.createElement('span', { className: 'req' }, '*')),
                  React.createElement('input', { className: 'a-inp', placeholder: 'เช่น ขอติดตั้ง Photoshop ที่เครื่องบัญชี', defaultValue: 'ขอติดตั้งโปรแกรม Photoshop' })),
                React.createElement('div', { className: 'a-field' },
                  React.createElement('label', { className: 'a-lbl' }, 'รายละเอียด', React.createElement('span', { className: 'req' }, '*')),
                  React.createElement('textarea', { className: 'a-ta', defaultValue: 'ใช้สำหรับงานออกแบบสื่อประชาสัมพันธ์ภายในบริษัท ขอติดตั้งที่เครื่องคอมพิวเตอร์ของแผนกบัญชี' })),
                React.createElement('div', { className: 'a-field' },
                  React.createElement('label', { className: 'a-lbl' }, 'ความเร่งด่วน'),
                  React.createElement('div', { className: 'a-urg' },
                    React.createElement('label', null, React.createElement('span', { className: 'dot' }), 'ปกติ'),
                    React.createElement('label', { className: 'on' }, React.createElement('span', { className: 'dot' }), 'เร่งด่วน'),
                    React.createElement('label', null, React.createElement('span', { className: 'dot' }), 'ด่วนที่สุด'))),
                React.createElement('div', { className: 'a-field' },
                  React.createElement('label', { className: 'a-lbl' }, 'แนบไฟล์'),
                  React.createElement('div', { className: 'a-file' }, React.createElement('b', null, 'คลิกเพื่อเลือกไฟล์'), ' หรือลากไฟล์มาวาง · รองรับ PDF, รูปภาพ'))),
              // section 2 approvers
              React.createElement('div', { className: 'a-card' },
                React.createElement('h3', { className: 'a-ct' }, React.createElement('span', { className: 'n' }, '2'), 'ผู้อนุมัติ'),
                React.createElement(Slot, { n: 1, role: 'หัวหน้าแผนก', name: 'วิชัย มั่นคง', mode: 'fixed' }),
                React.createElement(Slot, { n: 2, role: 'ผู้จัดการฝ่าย', name: '', mode: 'sel' }),
                React.createElement(Slot, { n: 3, role: 'หัวหน้าแผนก IT', name: 'ธนา ระบบดี', mode: 'fixed' }),
                React.createElement(Slot, { n: 4, role: 'ผู้อนุมัติงบประมาณ', name: 'ประภา การเงิน', mode: 'sel' }),
                React.createElement(Slot, { n: 5, role: 'ผู้บริหาร', name: '', mode: 'opt' })),
              // section 3 signature
              React.createElement('div', { className: 'a-card' },
                React.createElement('h3', { className: 'a-ct' }, React.createElement('span', { className: 'n' }, '3'), 'ลายเซ็นผู้ขอ'),
                React.createElement('div', { className: 'a-sigtabs' },
                  React.createElement('button', { className: 'on' }, '✎ วาดลายเซ็น'),
                  React.createElement('button', null, '⤓ ใช้ลายเซ็นเดิม')),
                React.createElement('div', { className: 'a-sigpad' }, React.createElement('span', { className: 'ph' }, 'วาดลายเซ็นที่นี่')),
                React.createElement('div', { className: 'a-sighint' },
                  React.createElement('span', null, 'ใช้เมาส์หรือนิ้วลากเพื่อเซ็น'),
                  React.createElement('a', null, 'ล้าง')))),
            // ── sidebar ──
            React.createElement('div', { className: 'a-side' },
              React.createElement('div', { className: 'a-sidecard' },
                React.createElement('h4', null, 'สรุปคำขอ'),
                React.createElement('div', { className: 'a-srow' }, React.createElement('span', { className: 'k' }, 'ผู้ขอ'), React.createElement('span', { className: 'v' }, 'สมชาย ใจดี')),
                React.createElement('div', { className: 'a-srow' }, React.createElement('span', { className: 'k' }, 'แผนก'), React.createElement('span', { className: 'v' }, 'บัญชี')),
                React.createElement('div', { className: 'a-srow' }, React.createElement('span', { className: 'k' }, 'ประเภท'), React.createElement('span', { className: 'v' }, 'ติดตั้งโปรแกรม')),
                React.createElement('div', { className: 'a-srow' }, React.createElement('span', { className: 'k' }, 'ผู้อนุมัติ'), React.createElement('span', { className: 'v' }, '5 ช่อง')),
                React.createElement('div', { className: 'a-srow' }, React.createElement('span', { className: 'k' }, 'สถานะ'), React.createElement('span', { className: 'v' }, 'ฉบับร่าง')),
                React.createElement('button', { className: 'a-btn pri' }, 'ส่งคำขอ'),
                React.createElement('button', { className: 'a-btn sec' }, 'บันทึกร่าง'),
                React.createElement('p', { className: 'a-note' }, 'เมื่อกดส่ง ระบบจะแจ้งผู้อนุมัติทุกช่องทางอีเมลพร้อมกัน')))))));
  }
  window.DirectionA = DirectionA;
})();
