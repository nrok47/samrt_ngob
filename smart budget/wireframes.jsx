// Three budget-report wireframes (Thai, corporate vibe, A4 single page)

const fmt = (n) => n.toLocaleString('th-TH');

// ---------- shared sample data ----------
const ROWS = [
  { cat: 'บุคลากร', items: [
    { name: 'เงินเดือน',          budget: 4200000, actual: 4180000 },
    { name: 'โบนัสและสวัสดิการ',     budget: 850000,  actual: 920000  },
    { name: 'ฝึกอบรม',             budget: 200000,  actual: 95000   },
  ]},
  { cat: 'การตลาด', items: [
    { name: 'แคมเปญดิจิทัล',        budget: 1200000, actual: 1380000 },
    { name: 'งานอีเวนต์',           budget: 450000,  actual: 312000  },
    { name: 'พีอาร์และคอนเทนต์',     budget: 300000,  actual: 285000  },
  ]},
  { cat: 'ปฏิบัติการ', items: [
    { name: 'เช่าสำนักงาน',         budget: 720000,  actual: 720000  },
    { name: 'ซอฟต์แวร์และไอที',     budget: 540000,  actual: 612000  },
    { name: 'อุปกรณ์สำนักงาน',      budget: 180000,  actual: 96000   },
  ]},
  { cat: 'อื่นๆ', items: [
    { name: 'เดินทางและรับรอง',     budget: 380000,  actual: 410000  },
    { name: 'ที่ปรึกษาและกฎหมาย',   budget: 250000,  actual: 145000  },
  ]},
];

const flat = ROWS.flatMap(g => g.items.map(it => ({ ...it, cat: g.cat })));
const totalBudget = flat.reduce((s, r) => s + r.budget, 0);
const totalActual = flat.reduce((s, r) => s + r.actual, 0);
const overall = totalActual / totalBudget;

const groupTotals = ROWS.map(g => ({
  cat: g.cat,
  budget: g.items.reduce((s, r) => s + r.budget, 0),
  actual: g.items.reduce((s, r) => s + r.actual, 0),
}));

// ---------- shared header ----------
function DocHeader({ stamp, kicker = "รายงานงบประมาณ", title, period = "ไตรมาส 2 / 2569" }) {
  return (
    <>
      {stamp && <div className="stamp">{stamp}</div>}
      <div className="doc-header">
        <div>
          <div style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#8a8580', marginBottom: 4 }}>
            {kicker}
          </div>
          <h1>{title}</h1>
        </div>
        <div className="meta">
          <div>PERIOD · {period}</div>
          <div>UPDATED · 07 พ.ค. 2569</div>
          <div>OWNER · ทีมการเงิน</div>
        </div>
      </div>
    </>
  );
}

// ---------- A: Executive Summary ----------
function WireframeA() {
  return (
    <div className="wf wfA">
      <DocHeader stamp="แบบ A · สรุปผู้บริหาร" title="ภาพรวมงบประมาณ ไตรมาส 2" />

      <div className="kpi-row">
        <div className="kpi primary">
          <div className="label">ใช้ไปแล้ว / งบรวม</div>
          <div className="value">{Math.round(overall * 100)}%</div>
          <div className="delta">฿{fmt(totalActual)} / ฿{fmt(totalBudget)}</div>
          <div className="bar"><i style={{ width: `${overall * 100}%` }} /></div>
        </div>
        <div className="kpi">
          <div className="label">คงเหลือ</div>
          <div className="value">฿{fmt(Math.round((totalBudget - totalActual) / 1000))}K</div>
          <div className="delta" style={{ color: '#8a8580' }}>เทียบเป้า ไตรมาส 2</div>
        </div>
        <div className="kpi">
          <div className="label">หมวดเกินงบ</div>
          <div className="value" style={{ color: '#d96a4a' }}>3</div>
          <div className="delta" style={{ color: '#6f8a82' }}>จากทั้งหมด {flat.length} รายการ</div>
        </div>
        <div className="kpi">
          <div className="label">หมวดต่ำกว่างบ</div>
          <div className="value" style={{ color: '#5aa463' }}>4</div>
          <div className="delta" style={{ color: '#6f8a82' }}>โอกาสจัดสรรใหม่</div>
        </div>
      </div>

      <div className="grid-2col">
        <section>
          <h2>รายละเอียดตามหมวด</h2>
          <div className="breakdown">
            {flat.map((r, i) => {
              const pct = r.actual / r.budget;
              const over = pct > 1;
              const under = pct < 0.6;
              return (
                <div key={i} className={`row ${over ? 'over' : ''} ${under ? 'under' : ''}`}>
                  <div className="swatch" />
                  <div className="name">{r.name} <span style={{ color: '#8a8580', fontSize: 11, marginLeft: 6 }}>· {r.cat}</span></div>
                  <div className="pct">{Math.round(pct * 100)}%</div>
                  <div className="amt">฿{fmt(r.actual)}</div>
                  <div className="meter"><i style={{ width: `${Math.min(pct, 1.2) * 100 / 1.2}%` }} /></div>
                </div>
              );
            })}
          </div>
        </section>

        <aside>
          <h2>ประเด็นที่ต้องดู</h2>
          <div className="alert-list">
            <div className="alert">
              <span className="h">▲ แคมเปญดิจิทัล เกินงบ 15%</span>
              ใช้ ฿1.38M จาก ฿1.20M — ทบทวนการจัดสรรไตรมาส 3
            </div>
            <div className="alert">
              <span className="h">▲ ซอฟต์แวร์และไอที เกินงบ 13%</span>
              เกิดจากการต่อใบอนุญาตประจำปี
            </div>
            <div className="alert">
              <span className="h">▲ โบนัสและสวัสดิการ เกินงบ 8%</span>
              สอดคล้องกับการรับพนักงานเพิ่ม
            </div>
            <div className="alert ok">
              <span className="h">● ฝึกอบรม ต่ำกว่างบ 53%</span>
              พิจารณาเลื่อนคอร์สหรือโยกงบไปหมวดที่จำเป็น
            </div>
          </div>

          <h2 style={{ marginTop: 28 }}>สิ่งที่ต้องทำต่อ</h2>
          <ol style={{ fontSize: 12, paddingLeft: 18, lineHeight: 1.7, margin: 0 }}>
            <li>ขออนุมัติปรับงบการตลาด ก่อน 15 พ.ค.</li>
            <li>ทบทวนสัญญาซอฟต์แวร์ที่ใกล้หมด</li>
            <li>นำเสนอที่ประชุมผู้บริหาร 20 พ.ค.</li>
          </ol>
        </aside>
      </div>

      <div className="footer-note">
        <span>BUDGET-REPORT-Q2-2569 · v1.0</span>
        <span>หน้า 1 / 1</span>
      </div>
    </div>
  );
}

// ---------- B: Grouped Ledger ----------
function WireframeB() {
  return (
    <div className="wf wfB">
      <DocHeader stamp="แบบ B · ตารางจัดกลุ่ม" title="รายงานงบประมาณรายหมวด ไตรมาส 2" />

      <div className="summary-strip">
        <div className="stat">
          <div className="l">งบประมาณรวม</div>
          <div className="v">฿{fmt(Math.round(totalBudget / 1000))}K</div>
          <div className="d">อนุมัติแล้ว</div>
        </div>
        <div className="stat">
          <div className="l">ใช้ไปแล้ว</div>
          <div className="v">฿{fmt(Math.round(totalActual / 1000))}K</div>
          <div className="d">ณ 07 พ.ค. 2569</div>
        </div>
        <div className="stat">
          <div className="l">% การใช้</div>
          <div className="v">{Math.round(overall * 100)}%</div>
          <div className={`d ${overall > 1 ? 'over' : ''}`}>{overall > 1 ? 'เกินเป้า' : 'อยู่ในกรอบ'}</div>
        </div>
        <div className="stat">
          <div className="l">คงเหลือ</div>
          <div className="v">฿{fmt(Math.round((totalBudget - totalActual) / 1000))}K</div>
          <div className="d">สำหรับเดือนที่เหลือ</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style={{ width: '32%' }}>รายการ</th>
            <th className="r">งบประมาณ</th>
            <th className="r">ใช้จริง</th>
            <th className="r">คงเหลือ</th>
            <th className="r">% ใช้</th>
            <th>ความคืบหน้า</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((g, gi) => {
            const gt = groupTotals[gi];
            return (
              <React.Fragment key={gi}>
                <tr className="group">
                  <td colSpan={6}>
                    {g.cat}
                    <span className="grpsum">฿{fmt(gt.actual)} / ฿{fmt(gt.budget)} · {Math.round(gt.actual / gt.budget * 100)}%</span>
                  </td>
                </tr>
                {g.items.map((it, ii) => {
                  const pct = it.actual / it.budget;
                  const over = pct > 1;
                  return (
                    <tr key={ii} className={`${over ? 'over flag-row' : ''}`}>
                      <td>{it.name}</td>
                      <td className="r">{fmt(it.budget)}</td>
                      <td className="r">{fmt(it.actual)}</td>
                      <td className="r">{fmt(it.budget - it.actual)}</td>
                      <td className="r pct">{Math.round(pct * 100)}%</td>
                      <td className="barcell">
                        <div className="b"><i style={{ width: `${Math.min(pct, 1.2) * 100 / 1.2}%` }} /></div>
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            );
          })}
          <tr className="total">
            <td>รวมทั้งหมด</td>
            <td className="r">{fmt(totalBudget)}</td>
            <td className="r">{fmt(totalActual)}</td>
            <td className="r">{fmt(totalBudget - totalActual)}</td>
            <td className="r">{Math.round(overall * 100)}%</td>
            <td className="barcell">
              <div className="b"><i style={{ width: `${overall * 100}%` }} /></div>
            </td>
          </tr>
        </tbody>
      </table>

      <div style={{ marginTop: 20, fontSize: 11, color: '#8a8580', display: 'flex', gap: 24, fontFamily: 'IBM Plex Mono, monospace' }}>
        <span>▲ = เกินงบประมาณ</span>
        <span>ทุกค่าเป็นบาท · ปัดเศษเป็นพันใกล้เคียง</span>
      </div>

      <div style={{ position: 'absolute', bottom: 32, left: 64, right: 64, paddingTop: 12, borderTop: '1px solid #d0ccc4', display: 'flex', justifyContent: 'space-between', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: '#8a8580' }}>
        <span>BUDGET-REPORT-Q2-2569 · v1.0</span>
        <span>หน้า 1 / 1</span>
      </div>
    </div>
  );
}

// ---------- C: Visual Dashboard ----------
function WireframeC() {
  // donut math
  const donutData = groupTotals.map(g => ({ ...g, share: g.actual / totalActual }));
  const colors = ['#2f8f7d', '#4a90c8', '#7bb89e', '#c8d96a'];
  let acc = 0;
  const segs = donutData.map((d, i) => {
    const start = acc;
    acc += d.share;
    return { ...d, start, end: acc, color: colors[i % colors.length] };
  });

  // monthly synthetic data
  const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const monthly = [
    { b: 80, a: 72 }, { b: 80, a: 78 }, { b: 80, a: 85 },
    { b: 80, a: 82 }, { b: 80, a: 60 }, { b: 80, a: 0 },
    { b: 80, a: 0 },  { b: 80, a: 0 },  { b: 80, a: 0 },
    { b: 80, a: 0 },  { b: 80, a: 0 },  { b: 80, a: 0 },
  ];
  const maxBar = 100;

  return (
    <div className="wf wfC">
      <DocHeader stamp="แบบ C · แดชบอร์ดภาพ" title="ภาพรวมงบประมาณเชิงภาพ ไตรมาส 2" />

      <div className="hero">
        <div className="big-num">
          <div>
          <div className="lbl">ใช้ไปแล้ว / งบประมาณรวม</div>
            <div className="v">{Math.round(overall * 100)}%</div>
            <div className="sub">฿{fmt(totalActual)} จาก ฿{fmt(totalBudget)}</div>
          </div>
          <div>
            <div className="progress"><i style={{ width: `${overall * 100}%` }} /></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontFamily: 'IBM Plex Mono, monospace', opacity: 0.65, marginTop: 6 }}>
              <span>เริ่มไตรมาส</span>
              <span>คาดสิ้นงวด · 102%</span>
            </div>
          </div>
        </div>

        <div className="donut-wrap">
          <svg viewBox="-1.1 -1.1 2.2 2.2" style={{ width: '100%', transform: 'rotate(-90deg)' }}>
            {segs.map((s, i) => {
              const a0 = s.start * Math.PI * 2;
              const a1 = s.end * Math.PI * 2;
              const x0 = Math.cos(a0), y0 = Math.sin(a0);
              const x1 = Math.cos(a1), y1 = Math.sin(a1);
              const large = (s.end - s.start) > 0.5 ? 1 : 0;
              return (
                <path
                  key={i}
                  d={`M ${x0} ${y0} A 1 1 0 ${large} 1 ${x1} ${y1} L ${x1 * 0.55} ${y1 * 0.55} A 0.55 0.55 0 ${large} 0 ${x0 * 0.55} ${y0 * 0.55} Z`}
                  fill={s.color}
                />
              );
            })}
          </svg>
          <div className="legend">
            {segs.map((s, i) => (
              <div className="lg-row" key={i}>
                <div className="sw" style={{ background: s.color }} />
                <div>{s.cat}</div>
                <div className="v">{Math.round(s.share * 100)}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="lower">
        <div className="timeline">
          <h2 style={{ borderBottom: 0, marginBottom: 0 }}>การใช้งบประมาณรายเดือน</h2>
          <div style={{ fontSize: 11, color: '#8a8580', marginBottom: 8 }}>เปรียบเทียบงบที่ตั้งไว้กับการใช้จริง · พ.ค. คือเดือนปัจจุบัน</div>
          <div className="chart">
            {monthly.map((m, i) => {
              const isFuture = m.a === 0 && i > 4;
              const over = m.a > m.b;
              return (
                <div key={i} style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'flex-end', gap: 2 }}>
                  <div className="col budget" style={{ height: `${m.b / maxBar * 100}%`, flex: 1, opacity: isFuture ? 0.5 : 1 }} />
                  {!isFuture && (
                    <div className={`col ${over ? 'over' : 'actual'}`} style={{ height: `${m.a / maxBar * 100}%`, flex: 1 }} />
                  )}
                </div>
              );
            })}
          </div>
          <div className="x">{months.map((m, i) => <div key={i}>{m}</div>)}</div>
          <div className="legend-mini">
            <span className="b">งบประมาณ</span>
            <span className="a">ใช้จริง</span>
            <span className="c">เกินงบ</span>
          </div>
        </div>

        <div className="watchlist">
          <h2 style={{ borderBottom: 0, marginBottom: 8 }}>รายการเฝ้าระวัง</h2>
          <div className="item over">
            <div className="nm">แคมเปญดิจิทัล</div>
            <div className="pct">115%</div>
            <div className="desc">การตลาด · เกินงบ ฿180K</div>
          </div>
          <div className="item over">
            <div className="nm">ซอฟต์แวร์และไอที</div>
            <div className="pct">113%</div>
            <div className="desc">ปฏิบัติการ · ต่อใบอนุญาตประจำปี</div>
          </div>
          <div className="item over">
            <div className="nm">โบนัสและสวัสดิการ</div>
            <div className="pct">108%</div>
            <div className="desc">บุคลากร · พนักงานใหม่ 3 คน</div>
          </div>
          <div className="item under">
            <div className="nm">ฝึกอบรม</div>
            <div className="pct">48%</div>
            <div className="desc">บุคลากร · ยังไม่ได้จัดคอร์ส</div>
          </div>
          <div className="item under">
            <div className="nm">ที่ปรึกษาและกฎหมาย</div>
            <div className="pct">58%</div>
            <div className="desc">อื่นๆ · ยังไม่ครบกำหนดชำระ</div>
          </div>
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 32, left: 64, right: 64, paddingTop: 12, borderTop: '1px solid #d0ccc4', display: 'flex', justifyContent: 'space-between', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: '#8a8580' }}>
        <span>BUDGET-REPORT-Q2-2569 · v1.0</span>
        <span>หน้า 1 / 1</span>
      </div>
    </div>
  );
}

Object.assign(window, { WireframeA, WireframeB, WireframeC });
