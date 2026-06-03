// Direction C — เอกสารดิจิทัล (Digital document)
// Centered "sheet" that mirrors the familiar paper request form. Warm slate + amber accent.
(function () {
  const CSS = `
  .c-root{--ink:#23201b;--muted:#6b655c;--line:#e0dcd3;--bg:#e7e3da;--sheet:#fcfbf8;
    --accent:oklch(0.55 0.1 65);--accent-soft:oklch(0.95 0.03 70);--accent-line:oklch(0.82 0.06 70);
    font-family:'Sarabun',sans-serif;color:var(--ink);background:var(--bg);width:100%;min-height:100%;padding:34px 0 44px;}
  .c-root *{box-sizing:border-box;}
  .c-toolbar{max-width:720px;margin:0 auto 18px;display:flex;align-items:center;gap:12px;padding:0 8px;}
  .c-toolbar .lead{font-size:13px;color:#7d766a;}
  .c-toolbar .sp{flex:1;}
  .c-tbtn{font:inherit;font-size:13.5px;font-weight:600;padding:9px 18px;border-radius:8px;border:1px solid #cfc9bd;background:#fcfbf8;color:var(--ink);cursor:pointer;}
  .c-tbtn.pri{background:var(--accent);border-color:var(--accent);color:#fff;}
  /* sheet */
  .c-sheet{max-width:720px;margin:0 auto;background:var(--sheet);border:1px solid var(--line);border-radius:5px;
    box-shadow:0 1px 0 rgba(0,0,0,.04),0 18px 50px -22px rgba(60,50,30,.4);padding:52px 60px 46px;}
  .c-hd{display:flex;align-items:flex-start;gap:16px;border-bottom:2.5px solid var(--ink);padding-bottom:20px;margin-bottom:6px;}
  .c-seal{width:52px;height:52px;border-radius:9px;border:1.5px solid var(--accent-line);background:var(--accent-soft);color:var(--accent);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:17px;flex:0 0 auto;}
  .c-hdmid{flex:1;}
  .c-org{font-size:13px;color:var(--muted);letter-spacing:.02em;}
  .c-doctitle{font-family:'Noto Serif Thai',serif;font-size:25px;font-weight:700;letter-spacing:-.01em;margin:1px 0 0;}
  .c-meta{text-align:right;font-size:13px;color:var(--muted);line-height:1.9;flex:0 0 auto;}
  .c-meta b{color:var(--ink);font-weight:600;}
  .c-sech{font-family:'Noto Serif Thai',serif;font-size:15px;font-weight:700;margin:26px 0 14px;padding-bottom:5px;border-bottom:1px dashed var(--line);}
  /* form lines */
  .c-fl{display:flex;align-items:baseline;gap:10px;margin-bottom:16px;}
  .c-fl .lab{font-size:14.5px;color:var(--muted);flex:0 0 auto;}
  .c-fl .val{flex:1;border-bottom:1.5px dotted #c8c2b6;padding:0 4px 5px;font-size:15.5px;font-weight:500;min-height:24px;}
  .c-fl .val.ph{color:#a8a194;font-weight:400;}
  .c-two{display:flex;gap:30px;}
  .c-two>.c-fl{flex:1;}
  .c-block .val{font-weight:400;line-height:1.7;}
  .c-chips{display:flex;gap:9px;margin-top:2px;}
  .c-chip{font-size:13.5px;padding:5px 15px;border-radius:4px;border:1px solid var(--line);color:var(--muted);}
  .c-chip.on{background:var(--accent-soft);border-color:var(--accent-line);color:var(--accent);font-weight:600;}
  /* approval signature grid */
  .c-sigs{display:grid;grid-template-columns:1fr 1fr;gap:18px 22px;margin-top:6px;}
  .c-sig{border:1px solid var(--line);border-radius:5px;padding:14px 16px 12px;background:#fff;}
  .c-sigrole{font-size:12.5px;color:var(--muted);display:flex;justify-content:space-between;align-items:center;}
  .c-sigrole .badge{font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:3px;}
  .c-sigrole .badge.fx{background:#f0ece3;color:#8a8273;}
  .c-sigrole .badge.se{background:var(--accent-soft);color:var(--accent);}
  .c-sigbox{height:60px;margin:10px 0 8px;border-radius:4px;background:repeating-linear-gradient(135deg,#fbfaf7,#fbfaf7 8px,#f1efe8 8px,#f1efe8 9px);display:flex;align-items:center;justify-content:center;font-family:ui-monospace,monospace;font-size:10.5px;color:#aaa294;}
  .c-signame{font-size:14.5px;font-weight:600;text-align:center;}
  .c-sigsub{font-size:11.5px;color:var(--muted);text-align:center;margin-top:2px;}
  .c-foot{margin-top:26px;padding-top:16px;border-top:1px dashed var(--line);font-size:12px;color:var(--muted);text-align:center;}
  `;
  function Sig({ role, name, sub, mode }) {
    const init = name ? name.trim().slice(0, 1) : '';
    return React.createElement('div', { className: 'c-sig' },
      React.createElement('div', { className: 'c-sigrole' }, role,
        React.createElement('span', { className: 'badge ' + (mode === 'fix' ? 'fx' : 'se') }, mode === 'fix' ? 'กำหนดไว้' : 'เลือกเอง')),
      React.createElement('div', { className: 'c-sigbox' }, name ? '' : 'ช่องเซ็น'),
      React.createElement('div', { className: 'c-signame' }, name || '—'),
      React.createElement('div', { className: 'c-sigsub' }, sub));
  }
  function DirectionC() {
    return React.createElement(React.Fragment, null,
      React.createElement('style', null, CSS),
      React.createElement('div', { className: 'c-root' },
        React.createElement('div', { className: 'c-toolbar' },
          React.createElement('span', { className: 'lead' }, 'แบบฟอร์มของคุณจะดูเหมือนใบคำขอจริง — กรอกได้เลยในช่องว่าง'),
          React.createElement('span', { className: 'sp' }),
          React.createElement('button', { className: 'c-tbtn' }, 'บันทึกร่าง'),
          React.createElement('button', { className: 'c-tbtn pri' }, 'ส่งคำขอ')),
        React.createElement('div', { className: 'c-sheet' },
          // header
          React.createElement('div', { className: 'c-hd' },
            React.createElement('div', { className: 'c-seal' }, 'IT'),
            React.createElement('div', { className: 'c-hdmid' },
              React.createElement('div', { className: 'c-org' }, 'แผนกเทคโนโลยีสารสนเทศ'),
              React.createElement('h1', { className: 'c-doctitle' }, 'ใบคำขอใช้งาน IT')),
            React.createElement('div', { className: 'c-meta' },
              React.createElement('div', null, 'เลขที่ ', React.createElement('b', null, 'REQ-2569-00123')),
              React.createElement('div', null, 'วันที่ ', React.createElement('b', null, '3 มิ.ย. 2569')))),
          // requester
          React.createElement('div', { className: 'c-sech' }, 'ข้อมูลผู้ขอ'),
          React.createElement('div', { className: 'c-two' },
            React.createElement('div', { className: 'c-fl' }, React.createElement('span', { className: 'lab' }, 'ชื่อผู้ขอ'), React.createElement('span', { className: 'val' }, 'สมชาย ใจดี')),
            React.createElement('div', { className: 'c-fl' }, React.createElement('span', { className: 'lab' }, 'แผนก'), React.createElement('span', { className: 'val' }, 'บัญชี'))),
          // detail
          React.createElement('div', { className: 'c-sech' }, 'รายละเอียดคำขอ'),
          React.createElement('div', { className: 'c-two' },
            React.createElement('div', { className: 'c-fl' }, React.createElement('span', { className: 'lab' }, 'ประเภท'), React.createElement('span', { className: 'val' }, 'ขอติดตั้งโปรแกรม')),
            React.createElement('div', { className: 'c-fl' }, React.createElement('span', { className: 'lab' }, 'ต้องการใช้วันที่'), React.createElement('span', { className: 'val' }, '10 มิ.ย. 2569'))),
          React.createElement('div', { className: 'c-fl' }, React.createElement('span', { className: 'lab' }, 'หัวข้อ'), React.createElement('span', { className: 'val' }, 'ขอติดตั้งโปรแกรม Photoshop')),
          React.createElement('div', { className: 'c-fl c-block', style: { flexDirection: 'column', alignItems: 'stretch', gap: '6px' } },
            React.createElement('span', { className: 'lab' }, 'รายละเอียด'),
            React.createElement('span', { className: 'val' }, 'ใช้สำหรับงานออกแบบสื่อประชาสัมพันธ์ภายในบริษัท ขอติดตั้งที่เครื่องคอมพิวเตอร์ของแผนกบัญชี')),
          React.createElement('div', { className: 'c-fl', style: { alignItems: 'center' } },
            React.createElement('span', { className: 'lab' }, 'ความเร่งด่วน'),
            React.createElement('div', { className: 'c-chips' },
              React.createElement('span', { className: 'c-chip' }, 'ปกติ'),
              React.createElement('span', { className: 'c-chip on' }, 'เร่งด่วน'),
              React.createElement('span', { className: 'c-chip' }, 'ด่วนที่สุด'))),
          // approvals
          React.createElement('div', { className: 'c-sech' }, 'ผู้อนุมัติ และ ลายเซ็น'),
          React.createElement('div', { className: 'c-sigs' },
            React.createElement(Sig, { role: 'หัวหน้าแผนก', name: 'วิชัย มั่นคง', sub: 'รออนุมัติ', mode: 'fix' }),
            React.createElement(Sig, { role: 'ผู้จัดการฝ่าย', name: '', sub: 'พิมพ์ชื่อเพื่อเลือก', mode: 'sel' }),
            React.createElement(Sig, { role: 'หัวหน้าแผนก IT', name: 'ธนา ระบบดี', sub: 'รออนุมัติ', mode: 'fix' }),
            React.createElement(Sig, { role: 'ผู้อนุมัติงบประมาณ', name: 'ประภา การเงิน', sub: 'รออนุมัติ', mode: 'sel' })),
          React.createElement('div', { className: 'c-foot' }, 'เมื่อกดส่ง ระบบจะส่งอีเมลแจ้งผู้อนุมัติทุกท่านพร้อมกันโดยอัตโนมัติ'))));
  }
  window.DirectionC = DirectionC;
})();
