// Direction B — ไกด์ทีละขั้น (Wizard)
// Vertical stepper sidebar + one focused step, large touch targets, teal accent.
(function () {
  const CSS = `
  .b-root{--ink:#19211f;--muted:#5c6b66;--line:#e4e8e6;--bg:#f3f5f4;--card:#fff;
    --accent:oklch(0.55 0.09 168);--accent-d:oklch(0.46 0.1 168);--accent-soft:oklch(0.96 0.025 168);--accent-line:oklch(0.85 0.05 168);
    font-family:'Anuphan',sans-serif;color:var(--ink);background:var(--bg);width:100%;min-height:100%;display:flex;}
  .b-root *{box-sizing:border-box;}
  /* stepper rail */
  .b-rail{width:288px;flex:0 0 auto;background:var(--card);border-right:1px solid var(--line);padding:30px 26px;display:flex;flex-direction:column;}
  .b-brand{display:flex;align-items:center;gap:11px;margin-bottom:34px;}
  .b-brand .mk{width:34px;height:34px;border-radius:9px;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;}
  .b-brand b{font-size:16px;font-weight:600;}
  .b-steps{display:flex;flex-direction:column;gap:2px;}
  .b-st{display:flex;gap:14px;padding:11px 10px;border-radius:10px;}
  .b-st.cur{background:var(--accent-soft);}
  .b-dot{width:30px;height:30px;border-radius:50%;flex:0 0 auto;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;border:2px solid var(--line);color:var(--muted);background:#fff;}
  .b-st.done .b-dot{background:var(--accent);border-color:var(--accent);color:#fff;}
  .b-st.cur .b-dot{border-color:var(--accent);color:var(--accent);}
  .b-stl{display:flex;flex-direction:column;justify-content:center;}
  .b-stl .t{font-size:14.5px;font-weight:600;line-height:1.2;}
  .b-st:not(.cur):not(.done) .b-stl .t{color:var(--muted);font-weight:500;}
  .b-stl .s{font-size:12px;color:var(--muted);margin-top:2px;}
  .b-railnote{margin-top:auto;font-size:12.5px;color:var(--muted);background:var(--accent-soft);border-radius:10px;padding:13px 15px;line-height:1.55;}
  /* main */
  .b-main{flex:1;min-width:0;display:flex;flex-direction:column;}
  .b-prog{height:5px;background:var(--line);}
  .b-prog i{display:block;height:100%;width:60%;background:var(--accent);}
  .b-body{padding:40px 56px 36px;flex:1;}
  .b-kick{font-size:13px;font-weight:700;color:var(--accent);letter-spacing:.04em;margin-bottom:8px;}
  .b-h1{font-size:30px;font-weight:700;letter-spacing:-.01em;margin:0 0 8px;}
  .b-lead{font-size:16px;color:var(--muted);margin:0 0 30px;line-height:1.5;max-width:560px;}
  .b-slot{display:flex;align-items:center;gap:18px;background:var(--card);border:1.5px solid var(--line);border-radius:14px;padding:18px 20px;margin-bottom:14px;}
  .b-slot.pick{border-style:dashed;border-color:var(--accent-line);}
  .b-num{width:40px;height:40px;border-radius:11px;flex:0 0 auto;background:var(--accent-soft);color:var(--accent-d);font-size:17px;font-weight:700;display:flex;align-items:center;justify-content:center;}
  .b-info{flex:1;min-width:0;}
  .b-role{font-size:13.5px;color:var(--muted);margin-bottom:4px;}
  .b-name{font-size:18px;font-weight:600;display:flex;align-items:center;gap:11px;}
  .b-av{width:38px;height:38px;border-radius:50%;flex:0 0 auto;background:#d6ded9;color:#516159;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;}
  .b-search{display:flex;align-items:center;gap:12px;border:1.5px solid var(--accent-line);background:#fff;border-radius:11px;padding:9px 14px;}
  .b-search input{border:none;outline:none;font:inherit;font-size:16px;background:transparent;flex:1;color:var(--ink);}
  .b-pill{font-size:13px;font-weight:600;padding:6px 14px;border-radius:30px;flex:0 0 auto;}
  .b-pill.fix{background:#eef1ef;color:var(--muted);}
  .b-pill.you{background:var(--accent);color:#fff;}
  .b-pill.opt{background:#fff;border:1.5px solid var(--line);color:var(--muted);}
  .b-foot{display:flex;align-items:center;gap:14px;padding:20px 56px;border-top:1px solid var(--line);background:var(--card);}
  .b-back{font:inherit;font-size:16px;font-weight:600;padding:15px 28px;border-radius:12px;border:1.5px solid var(--line);background:#fff;color:var(--ink);cursor:pointer;}
  .b-next{font:inherit;font-size:16px;font-weight:700;padding:15px 40px;border-radius:12px;border:none;background:var(--accent);color:#fff;cursor:pointer;margin-left:auto;display:flex;align-items:center;gap:9px;}
  .b-save{font:inherit;font-size:15px;font-weight:600;color:var(--muted);background:none;border:none;cursor:pointer;}
  `;
  function St({ n, t, s, state }) {
    return React.createElement('div', { className: 'b-st ' + state },
      React.createElement('div', { className: 'b-dot' }, state === 'done' ? '✓' : n),
      React.createElement('div', { className: 'b-stl' },
        React.createElement('div', { className: 't' }, t),
        s ? React.createElement('div', { className: 's' }, s) : null));
  }
  function DirectionB() {
    return React.createElement(React.Fragment, null,
      React.createElement('style', null, CSS),
      React.createElement('div', { className: 'b-root' },
        // rail
        React.createElement('div', { className: 'b-rail' },
          React.createElement('div', { className: 'b-brand' },
            React.createElement('div', { className: 'mk' }, 'IT'),
            React.createElement('b', null, 'ขอใช้งาน IT')),
          React.createElement('div', { className: 'b-steps' },
            React.createElement(St, { n: 1, t: 'เลือกประเภทคำขอ', s: 'ขอติดตั้งโปรแกรม', state: 'done' }),
            React.createElement(St, { n: 2, t: 'กรอกรายละเอียด', s: 'หัวข้อ · รายละเอียด', state: 'done' }),
            React.createElement(St, { n: 3, t: 'เลือกผู้อนุมัติ', s: 'ใครต้องเซ็นบ้าง', state: 'cur' }),
            React.createElement(St, { n: 4, t: 'เซ็นรับรอง', s: '', state: '' }),
            React.createElement(St, { n: 5, t: 'ตรวจสอบ & ส่ง', s: '', state: '' })),
          React.createElement('div', { className: 'b-railnote' }, '💡 ช่องที่บริษัทกำหนดไว้แล้ว คุณไม่ต้องเลือก — แค่เลือกเฉพาะช่องที่มีคำว่า “เลือกเอง”')),
        // main
        React.createElement('div', { className: 'b-main' },
          React.createElement('div', { className: 'b-prog' }, React.createElement('i', null)),
          React.createElement('div', { className: 'b-body' },
            React.createElement('div', { className: 'b-kick' }, 'ขั้นตอนที่ 3 จาก 5'),
            React.createElement('h1', { className: 'b-h1' }, 'ใครเป็นผู้อนุมัติคำขอนี้?'),
            React.createElement('p', { className: 'b-lead' }, 'บางช่องบริษัทกำหนดไว้ให้แล้ว ส่วนช่องที่ต้องเลือกเอง ให้พิมพ์ชื่อแล้วเลือกจากรายชื่อพนักงานได้เลย'),
            // slot 1 fixed
            React.createElement('div', { className: 'b-slot' },
              React.createElement('div', { className: 'b-num' }, '1'),
              React.createElement('div', { className: 'b-info' },
                React.createElement('div', { className: 'b-role' }, 'หัวหน้าแผนก'),
                React.createElement('div', { className: 'b-name' }, React.createElement('span', { className: 'b-av' }, 'วช'), 'วิชัย มั่นคง')),
              React.createElement('span', { className: 'b-pill fix' }, 'กำหนดไว้แล้ว')),
            // slot 2 pick
            React.createElement('div', { className: 'b-slot pick' },
              React.createElement('div', { className: 'b-num' }, '2'),
              React.createElement('div', { className: 'b-info' },
                React.createElement('div', { className: 'b-role' }, 'ผู้จัดการฝ่าย'),
                React.createElement('div', { className: 'b-search' },
                  React.createElement('span', { className: 'b-av' }, '🔍'),
                  React.createElement('input', { placeholder: 'พิมพ์ชื่อพนักงาน…' }))),
              React.createElement('span', { className: 'b-pill you' }, 'เลือกเอง')),
            // slot 3 fixed
            React.createElement('div', { className: 'b-slot' },
              React.createElement('div', { className: 'b-num' }, '3'),
              React.createElement('div', { className: 'b-info' },
                React.createElement('div', { className: 'b-role' }, 'หัวหน้าแผนก IT'),
                React.createElement('div', { className: 'b-name' }, React.createElement('span', { className: 'b-av' }, 'ธน'), 'ธนา ระบบดี')),
              React.createElement('span', { className: 'b-pill fix' }, 'กำหนดไว้แล้ว')),
            // slot 4 selected
            React.createElement('div', { className: 'b-slot' },
              React.createElement('div', { className: 'b-num' }, '4'),
              React.createElement('div', { className: 'b-info' },
                React.createElement('div', { className: 'b-role' }, 'ผู้อนุมัติงบประมาณ'),
                React.createElement('div', { className: 'b-name' }, React.createElement('span', { className: 'b-av' }, 'ปภ'), 'ประภา การเงิน')),
              React.createElement('span', { className: 'b-pill you' }, 'เลือกเอง')),
            // slot 5 optional
            React.createElement('div', { className: 'b-slot' },
              React.createElement('div', { className: 'b-num' }, '5'),
              React.createElement('div', { className: 'b-info' },
                React.createElement('div', { className: 'b-role' }, 'ผู้บริหาร (ถ้ามี)'),
                React.createElement('div', { className: 'b-name', style: { color: '#9aa6a1', fontWeight: 500, fontSize: '16px' } }, 'ไม่บังคับ — ข้ามได้')),
              React.createElement('span', { className: 'b-pill opt' }, 'เลือกหรือข้าม'))),
          // footer
          React.createElement('div', { className: 'b-foot' },
            React.createElement('button', { className: 'b-back' }, '← ย้อนกลับ'),
            React.createElement('button', { className: 'b-save' }, 'บันทึกร่าง'),
            React.createElement('button', { className: 'b-next' }, 'ถัดไป: เซ็นรับรอง →')))));
  }
  window.DirectionB = DirectionB;
})();
