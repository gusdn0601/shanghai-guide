/* ===================== ILLUSTRATIONS ===================== */
const W = (inner, sky) => `<svg class="art" viewBox="0 0 320 123" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style="background:${sky||'var(--sky1)'}">${inner}</svg>`;
const sun = `<circle cx="262" cy="34" r="16" fill="var(--sky2)"/>`;
const ART = {
  hotel: W(`${sun}<rect y="104" width="320" height="19" fill="var(--bld-2)"/>
    <path d="M110 104V40h100v64z" fill="var(--bld)"/><path d="M130 40V24h60v16z" fill="var(--bld)"/><path d="M148 24V12h24v12z" fill="var(--bld-2)"/>
    ${[0,1,2,3,4,5,6,7].map(i=>`<rect x="${120+i*11}" y="48" width="5" height="52" fill="var(--win)"/>`).join('')}
    <rect x="150" y="84" width="20" height="20" fill="var(--jade)"/><rect x="40" y="70" width="50" height="34" fill="var(--bld-2)"/><rect x="230" y="62" width="60" height="42" fill="var(--bld-2)"/>
    <text x="160" y="36" text-anchor="middle" font-size="7" fill="var(--jade)" font-family="sans-serif" letter-spacing="1">1934</text>`),
  duck: W(`${sun}<ellipse cx="160" cy="98" rx="120" ry="18" fill="var(--card)"/><ellipse cx="160" cy="94" rx="96" ry="12" fill="var(--paper)"/>
    <path d="M110 92c0-26 30-42 58-38 22 3 40 14 46 30l14-2c4 0 4 6 0 7l-14 3z" fill="#b6612e"/><path d="M122 84c10-14 34-20 56-14" stroke="#e7a25b" stroke-width="3" fill="none"/>
    ${[0,1,2].map(i=>`<ellipse cx="${60+i*6}" cy="${96-i*3}" rx="22" ry="7" fill="#f2e6c9" stroke="var(--bld-2)" stroke-width=".8"/>`).join('')}
    <rect x="240" y="80" width="30" height="14" rx="3" fill="var(--lacquer)"/><path d="M246 87h18" stroke="var(--card)" stroke-width="2"/>`),
  garden: W(`${sun}<rect y="88" width="320" height="35" fill="var(--water)"/>
    <path d="M196 70h80l-6-9h-68z" fill="var(--jade)"/><path d="M186 62c20-4 30-12 34-22h52c4 10 14 18 34 22z" fill="var(--lacquer)"/><path d="M206 40l40-10 40 10z" fill="var(--jade)"/>
    <rect x="204" y="62" width="62" height="24" fill="var(--bld)"/><rect x="214" y="68" width="10" height="18" fill="var(--jade)"/><rect x="246" y="68" width="10" height="18" fill="var(--jade)"/>
    <polyline points="0,96 30,90 50,98 76,90 98,98 124,90 146,98 170,90 196,96" fill="none" stroke="var(--bld-2)" stroke-width="5" stroke-linejoin="round"/>
    <path d="M40 20c-12 20-18 50-14 70M40 20c8 18 10 40 6 64M40 20c-22 14-34 30-36 56" stroke="var(--jade-2)" stroke-width="2" fill="none"/>`),
  bund: W(`<rect y="96" width="320" height="27" fill="var(--water)"/>${sun}
    <g fill="var(--bld)"><rect x="16" y="56" width="56" height="42"/><path d="M28 56a16 16 0 0 1 32 0z"/><rect x="80" y="50" width="34" height="48"/><rect x="90" y="24" width="14" height="26"/><rect x="118" y="46" width="36" height="52"/><rect x="160" y="62" width="40" height="36"/><rect x="206" y="56" width="34" height="42"/><rect x="246" y="66" width="56" height="32"/></g>
    <circle cx="97" cy="36" r="4.5" fill="var(--win)"/><path d="M124 46l12-22 12 22z" fill="var(--jade-2)"/>
    <g fill="var(--win)" opacity=".85">${[22,34,46,58,124,136,148,166,180,212,224,252,268,284].map((x,i)=>`<rect x="${x}" y="${i%2?70:80}" width="5" height="9"/>`).join('')}</g>
    <path d="M0 98h320" stroke="var(--bld-2)" stroke-width="3"/>`),
  night: W(`<rect width="320" height="123" fill="#1b2240"/><circle cx="40" cy="22" r="1.5" fill="#fff"/><circle cx="120" cy="14" r="1.2" fill="#fff"/><circle cx="290" cy="30" r="1.3" fill="#fff"/>
    <rect y="92" width="320" height="31" fill="#10283a"/>
    <g fill="#2d3a6a"><rect x="30" y="40" width="7" height="54"/><circle cx="33" cy="54" r="10" fill="#e75a8a"/><circle cx="33" cy="78" r="6" fill="#e75a8a"/><path d="M90 94V36l7-10 7 10v58z"/><path d="M130 94V30h18v64z"/><path d="M180 94C178 60 184 30 190 6c6 24 12 54 10 88z"/><rect x="230" y="62" width="30" height="32"/><rect x="270" y="70" width="26" height="24"/></g>
    <g stroke="#f2c96b" stroke-width="2" opacity=".7"><path d="M20 104h40M90 110h30M170 106h44M240 112h30"/></g><rect x="134" y="36" width="10" height="6" fill="#1b2240"/>`, '#1b2240'),
  basket: W(`${sun}<ellipse cx="160" cy="98" rx="100" ry="20" fill="#c7a26a"/><ellipse cx="160" cy="90" rx="92" ry="16" fill="#e0c28c"/>
    ${[[110,82],[140,76],[172,76],[204,82],[126,94],[160,92],[194,94]].map(([x,y])=>`<path d="M${x-14} ${y+6}c0-12 8-18 14-18s14 6 14 18z" fill="#fbf4e4"/><path d="M${x-4} ${y-10}l4-4 4 4" stroke="#e0cfae" fill="none"/>`).join('')}
    <path d="M90 40c4-8-4-12 0-20M160 34c4-8-4-12 0-20M230 40c4-8-4-12 0-20" stroke="var(--card)" stroke-width="2.5" fill="none" opacity=".8"/>`),
  street: W(`${sun}<rect y="100" width="320" height="23" fill="var(--bld-2)"/>
    <g fill="var(--bld)"><rect x="10" y="30" width="60" height="70"/><rect x="80" y="44" width="50" height="56"/><rect x="190" y="36" width="60" height="64"/><rect x="258" y="50" width="52" height="50"/></g>
    <g fill="var(--lacquer)"><rect x="56" y="38" width="9" height="40"/><rect x="236" y="44" width="9" height="40"/></g>
    <g fill="var(--brass)"><rect x="116" y="52" width="9" height="34"/></g>
    <rect x="132" y="70" width="58" height="28" rx="6" fill="var(--jade)"/><rect x="138" y="76" width="12" height="10" fill="var(--win)"/><rect x="155" y="76" width="12" height="10" fill="var(--win)"/><rect x="172" y="76" width="12" height="10" fill="var(--win)"/>
    <circle cx="146" cy="100" r="4" fill="var(--ink)"/><circle cx="176" cy="100" r="4" fill="var(--ink)"/>`),
  tart: W(`${sun}<ellipse cx="160" cy="100" rx="120" ry="14" fill="var(--card)"/>
    ${[[110,84],[160,80],[210,84]].map(([x,y])=>`<path d="M${x-30} ${y}l6 16h48l6-16z" fill="#d79a4a"/><ellipse cx="${x}" cy="${y}" rx="30" ry="9" fill="#f6d36a"/><ellipse cx="${x+6}" cy="${y-1}" rx="10" ry="4" fill="#a8581e" opacity=".8"/>`).join('')}`),
  water: W(`${sun}<rect y="86" width="320" height="37" fill="var(--water)"/>
    <g><rect x="10" y="50" width="70" height="38" fill="#f4f1ea"/><path d="M4 52l40-18 42 18z" fill="#3a3f3c"/><rect x="236" y="46" width="78" height="42" fill="#f4f1ea"/><path d="M230 48l44-18 46 18z" fill="#3a3f3c"/>
    <rect x="24" y="62" width="10" height="12" fill="#3a3f3c"/><rect x="50" y="62" width="10" height="12" fill="#3a3f3c"/><rect x="252" y="60" width="10" height="12" fill="#3a3f3c"/><rect x="284" y="60" width="10" height="12" fill="#3a3f3c"/></g>
    <path d="M90 92c10-40 120-40 130 0" stroke="#c9c2b2" stroke-width="10" fill="none"/><path d="M96 92h-12M226 92h12" stroke="#c9c2b2" stroke-width="10"/>
    <path d="M120 108h60l-8 8h-44z" fill="#5c3b22"/><path d="M146 108c0-10 6-14 10-14" stroke="#5c3b22" stroke-width="2" fill="none"/>
    <ellipse cx="155" cy="96" rx="42" ry="4" fill="var(--sky2)" opacity=".35"/>`),
  temple: W(`${sun}<rect y="100" width="320" height="23" fill="var(--bld-2)"/>
    <rect x="100" y="70" width="120" height="30" fill="var(--lacquer)"/>
    <path d="M86 72c24-4 40-12 46-20h56c6 8 22 16 46 20z" fill="#d9a63a"/><rect x="118" y="44" width="84" height="10" fill="var(--lacquer)"/>
    <path d="M104 46c18-2 30-8 36-16h40c6 8 18 14 36 16z" fill="#d9a63a"/><path d="M150 30l10-16 10 16z" fill="#d9a63a"/>
    <rect x="150" y="80" width="20" height="20" fill="#3a2a1a"/>
    <rect x="34" y="40" width="40" height="60" fill="var(--bld)"/><rect x="250" y="34" width="50" height="66" fill="var(--bld)"/>`),
  roastery: W(`${sun}<rect y="104" width="320" height="19" fill="var(--bld-2)"/>
    <rect x="150" y="26" width="64" height="78" rx="8" fill="#b9733d"/><g stroke="#8a4f22" stroke-width="2">${[38,52,66,80,94].map(y=>`<path d="M150 ${y}h64"/>`).join('')}</g>
    <path d="M182 26V8h120" stroke="#8a4f22" stroke-width="4" fill="none"/><path d="M40 8h142" stroke="#8a4f22" stroke-width="4"/>
    <path d="M60 74h44v20a12 12 0 0 1-12 12H72a12 12 0 0 1-12-12z" fill="var(--card)"/><path d="M104 80c10 0 10 14 0 14" stroke="var(--card)" stroke-width="4" fill="none"/>
    <path d="M72 64c4-6-4-8 0-14M88 64c4-6-4-8 0-14" stroke="var(--ink-2)" stroke-width="2" fill="none"/>`),
  ship: W(`${sun}<rect y="96" width="320" height="27" fill="var(--water)"/>
    <path d="M40 74h240l-24 24H70z" fill="#a8322a"/><path d="M70 74V54h170v20z" fill="#cfd3d6"/><g fill="#9aa3a8">${[80,98,116,134,152,170,188,206,224].map(x=>`<circle cx="${x}" cy="64" r="3"/>`).join('')}</g>
    <rect x="120" y="32" width="70" height="22" rx="3" fill="#8a5a2e"/><rect x="150" y="28" width="10" height="4" fill="#8a5a2e"/><path d="M120 43h70" stroke="#d9a63a" stroke-width="2"/>`),
  skewer: W(`${sun}<rect y="96" width="320" height="27" fill="#3a2a22"/>
    ${[0,1,2,3,4].map(i=>`<g transform="rotate(-14 ${80+i*40} 80)"><path d="M${80+i*40} 30v80" stroke="#c9a77a" stroke-width="3"/>${[44,58,72].map(y=>`<rect x="${72+i*40}" y="${y}" width="16" height="11" rx="3" fill="${y===58?'#f0d6b6':'#9a4b22'}"/>`).join('')}</g>`).join('')}
    <path d="M60 110c6-6 12-6 18 0M150 112c6-6 12-6 18 0M240 110c6-6 12-6 18 0" stroke="#e5703a" stroke-width="3" fill="none"/>`),
  towers: W(`${sun}<rect y="104" width="320" height="19" fill="var(--water)"/>
    <g fill="var(--jade)"><rect x="56" y="40" width="6" height="64"/><circle cx="59" cy="58" r="10" fill="var(--lacquer)"/><circle cx="59" cy="86" r="7" fill="var(--lacquer)"/>
    <path d="M110 104V36l9-14 9 14v68z"/><path d="M148 104V26h22v78z"/><rect x="154" y="30" width="10" height="7" fill="var(--sky1)"/>
    <path d="M196 104C194 66 200 28 210 2c10 26 16 64 14 102z" fill="var(--jade-2)"/><rect x="240" y="72" width="30" height="32"/><rect x="276" y="80" width="24" height="24"/></g>
    <text x="119" y="16" text-anchor="middle" font-size="7" fill="var(--ink-2)" font-family="sans-serif">주사기</text><text x="159" y="20" text-anchor="middle" font-size="7" fill="var(--ink-2)" font-family="sans-serif">병따개</text><text x="232" y="14" font-size="7" fill="var(--ink-2)" font-family="sans-serif">거품기</text>`),
  tower: W(`${sun}<rect y="106" width="320" height="17" fill="var(--water)"/>
    <path d="M140 106C136 66 146 26 160 0c14 26 24 66 20 106z" fill="var(--jade-2)"/><path d="M152 106C150 70 154 30 162 6" stroke="var(--jade)" stroke-width="2" fill="none"/>
    <rect x="148" y="30" width="24" height="5" fill="var(--win)"/><text x="186" y="34" font-size="8" fill="var(--ink-2)" font-family="sans-serif">118F · 546m</text>
    <path d="M60 106V60h30v46zM230 106V72h40v34z" fill="var(--bld)"/>
    <path d="M196 92V54" stroke="var(--lacquer)" stroke-width="2" stroke-dasharray="3 3"/><path d="M192 58l4-6 4 6" fill="var(--lacquer)"/><text x="202" y="76" font-size="8" fill="var(--lacquer)" font-family="sans-serif">초속 18m</text>`),
  hotpot: W(`${sun}<ellipse cx="160" cy="104" rx="110" ry="12" fill="var(--bld-2)"/>
    <path d="M90 70h140c0 26-30 38-70 38s-70-12-70-38z" fill="#9aa3a8"/><ellipse cx="160" cy="70" rx="70" ry="12" fill="#f3e3c4"/>
    ${[[130,68],[170,66],[190,72]].map(([x,y])=>`<path d="M${x} ${y}c6-3 12-3 18 0" stroke="#c4553e" stroke-width="4" fill="none"/>`).join('')}
    <circle cx="146" cy="72" r="4" fill="#e9dfcf"/><circle cx="156" cy="74" r="4" fill="#e9dfcf"/>
    <path d="M130 46c4-8-4-12 0-20M160 42c4-8-4-12 0-20M190 46c4-8-4-12 0-20" stroke="var(--card)" stroke-width="2.5" fill="none" opacity=".8"/>
    <rect x="240" y="82" width="54" height="18" rx="3" fill="#c4553e"/><path d="M244 88h46M244 94h46" stroke="#f0b8a8" stroke-width="1.5"/>`),
  bus: W(`${sun}<rect y="98" width="320" height="25" fill="var(--bld-2)"/><path d="M0 106h320" stroke="var(--win)" stroke-dasharray="14 10" stroke-width="2"/>
    <rect x="96" y="58" width="128" height="40" rx="8" fill="var(--jade)"/>${[0,1,2,3,4].map(i=>`<rect x="${106+i*22}" y="64" width="16" height="13" rx="2" fill="var(--win)"/>`).join('')}
    <circle cx="124" cy="98" r="7" fill="var(--ink)"/><circle cx="196" cy="98" r="7" fill="var(--ink)"/>
    <path d="M20 90l20-34 20 34zM260 92l24-40 24 40z" fill="var(--jade-2)" opacity=".6"/>`)
};

