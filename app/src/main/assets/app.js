(function () {
  'use strict';

  var KEY = 'calendario.eventos.v1';
  var VKEY = 'calendario.visao';
  var COLORS = ['#1a9be6', '#16a34a', '#8b5cf6', '#f59e0b', '#e11d48', '#ec4899'];
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var MESES3 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  var DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  var DIAS3 = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
  var DIAS1 = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  function $(id) { return document.getElementById(id); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  // ---------- datas e horas ----------
  function fmt(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(k) { var p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function addMonths(d, n) {
    var y = d.getFullYear(), m = d.getMonth() + n;
    var last = new Date(y, m + 1, 0).getDate();
    return new Date(y, m, Math.min(d.getDate(), last));
  }
  function startOfWeek(d) { return addDays(d, -d.getDay()); }
  function dstr(d) { return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear(); }
  function toMin(t) { var p = t.split(':'); return (+p[0]) * 60 + (+p[1]); }
  function toTime(m) { m = Math.max(0, Math.min(1439, m)); return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
  function addMin(t, n) { return toTime(toMin(t) + n); }
  function nowMin() { var n = new Date(); return n.getHours() * 60 + n.getMinutes(); }
  function dateOnly(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

  // ---------- feriados nacionais ----------
  function easter(y) {
    var a = y % 19, b = Math.floor(y / 100), c = y % 100;
    var d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    var g = Math.floor((b - f + 1) / 3);
    var h = (19 * a + b - d - g + 15) % 30;
    var i = Math.floor(c / 4), k = c % 4;
    var l = (32 + 2 * e + 2 * i - h - k) % 7;
    var m = Math.floor((a + 11 * h + 22 * l) / 451);
    var month = Math.floor((h + l - 7 * m + 114) / 31);
    var day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(y, month - 1, day);
  }
  var holCache = {};
  function holidays(y) {
    if (holCache[y]) return holCache[y];
    var h = {};
    h[y + '-01-01'] = 'Confraternização Universal';
    h[y + '-04-21'] = 'Tiradentes';
    h[y + '-05-01'] = 'Dia do Trabalho';
    h[y + '-09-07'] = 'Independência do Brasil';
    h[y + '-10-12'] = 'Nossa Senhora Aparecida';
    h[y + '-11-02'] = 'Finados';
    h[y + '-11-15'] = 'Proclamação da República';
    h[y + '-11-20'] = 'Consciência Negra';
    h[y + '-12-25'] = 'Natal';
    var p = easter(y);
    h[fmt(addDays(p, -47))] = 'Carnaval';
    h[fmt(addDays(p, -2))] = 'Sexta-feira Santa';
    h[fmt(p)] = 'Páscoa';
    h[fmt(addDays(p, 60))] = 'Corpus Christi';
    holCache[y] = h;
    return h;
  }
  function holidayOf(k) { return holidays(+k.slice(0, 4))[k]; }

  // ---------- armazenamento ----------
  var mem = {};
  function lsGet(k) {
    try { var v = localStorage.getItem(k); return v === null ? (mem[k] || null) : v; } catch (e) { return mem[k] || null; }
  }
  function lsSet(k, v) { mem[k] = v; try { localStorage.setItem(k, v); } catch (e) { /* ignora */ } }

  function migrate(e) {
    if (!e || !e.date) return null;
    var o = {
      id: e.id || uid(), title: e.title || '(sem título)', date: e.date,
      note: e.note || '', color: e.color || COLORS[0], start: '', end: '', allDay: false
    };
    if (typeof e.allDay === 'boolean') { o.allDay = e.allDay; o.start = e.start || ''; o.end = e.end || ''; }
    else if (e.time) { o.start = e.time; o.end = addMin(e.time, 60); }
    else { o.allDay = true; }
    if (!o.allDay && !o.start) o.allDay = true;
    if (!o.allDay && !o.end) o.end = addMin(o.start, 60);
    return o;
  }
  function loadEvents() {
    var list = [];
    try { list = JSON.parse(lsGet(KEY)) || []; } catch (e) { list = []; }
    return list.map(migrate).filter(Boolean);
  }
  function saveEvents() { lsSet(KEY, JSON.stringify(events)); }

  // ---------- cores ----------
  function mix(c, t, a) { return [0, 1, 2].map(function (i) { return Math.round(c[i] * a + t * (1 - a)); }); }
  function tone(hex) {
    var n = parseInt(hex.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    return '--ebd:' + hex + ';--ebg:rgb(' + mix(c, 255, 0.14).join(',') + ');--efg:rgb(' + mix(c, 0, 0.6).join(',') + ')';
  }

  // ---------- estado ----------
  var events = loadEvents();
  var today = dateOnly(new Date());
  var sel = new Date(today);
  var mini = { y: sel.getFullYear(), m: sel.getMonth() };
  var mode = lsGet(VKEY) || 'week';
  if (['day', 'week', 'month', 'year'].indexOf(mode) < 0) mode = 'week';
  var query = '';
  var scrollHour = null;
  var editingId = null;
  var chosenColor = COLORS[0];

  function sortEv(a, b) {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    return (a.start || '').localeCompare(b.start || '') || a.title.localeCompare(b.title);
  }
  function eventsOn(k) { return events.filter(function (e) { return e.date === k; }).sort(sortEv); }
  function timeText(e) { return e.allDay ? 'Dia inteiro' : e.start + ' – ' + e.end; }

  // ---------- barra lateral: mini calendário ----------
  function renderMini() {
    $('mini-title').innerHTML = cap(MESES[mini.m]) + ' <span>' + mini.y + '</span>';
    var first = new Date(mini.y, mini.m, 1), start = addDays(first, -first.getDay());
    var tk = fmt(today), sk = fmt(sel), html = '';
    for (var i = 0; i < 42; i++) {
      var d = addDays(start, i), k = fmt(d), dots = '';
      var list = eventsOn(k), seen = {}, n = 0;
      if (holidayOf(k)) { dots += '<i style="background:#e5322d"></i>'; n++; }
      list.forEach(function (e) { if (n < 3 && !seen[e.color]) { seen[e.color] = 1; dots += '<i style="background:' + e.color + '"></i>'; n++; } });
      html += '<button class="md' + (d.getMonth() !== mini.m ? ' out' : '') + (k === tk ? ' today' : '') + (k === sk ? ' sel' : '') +
        '" data-date="' + k + '"><span class="n">' + d.getDate() + '</span><span class="dd">' + dots + '</span></button>';
    }
    $('mini-grid').innerHTML = html;
  }

  // ---------- barra lateral: agenda ----------
  function renderAgenda() {
    var html = '', shown = 0;
    for (var i = 0; i < 60 && shown < 7; i++) {
      var d = addDays(today, i), k = fmt(d), list = eventsOn(k), hol = holidayOf(k);
      if (i > 0 && !list.length && !hol) continue;
      shown++;
      var label = i === 0 ? 'HOJE' : i === 1 ? 'AMANHÃ' : DIAS[d.getDay()].toUpperCase();
      html += '<div class="ag-day"><div class="ag-h"><b' + (i === 0 ? ' class="today"' : '') + '>' + label + '</b><span>' + dstr(d) + '</span></div>';
      if (hol) html += '<div class="pill hol">' + esc(hol) + '</div>';
      list.forEach(function (e) {
        if (e.allDay) {
          html += '<button class="pill" data-id="' + e.id + '" style="background:' + e.color + '">' + esc(e.title) + '</button>';
        } else {
          html += '<button class="ag-ev" data-id="' + e.id + '"><i style="background:' + e.color + '"></i><span class="at">' +
            timeText(e) + '</span><span class="an">' + esc(e.title) + '</span></button>';
        }
      });
      if (!list.length && !hol) html += '<div class="ag-empty">Sem eventos</div>';
      html += '</div>';
    }
    $('agenda').innerHTML = html;
  }

  // ---------- barra de ferramentas ----------
  function rangeLabel() {
    if (query) return 'Resultados da busca';
    if (mode === 'year') return '' + sel.getFullYear();
    if (mode === 'month') return cap(MESES[sel.getMonth()]) + ' de ' + sel.getFullYear();
    if (mode === 'day') return cap(DIAS[sel.getDay()]) + ', ' + sel.getDate() + ' de ' + MESES[sel.getMonth()] + ' de ' + sel.getFullYear();
    var s = startOfWeek(sel), e = addDays(s, 6);
    var diffM = s.getMonth() !== e.getMonth() || s.getFullYear() !== e.getFullYear();
    var a = s.getDate() + (diffM ? ' de ' + MESES3[s.getMonth()] + '.' : '') + (s.getFullYear() !== e.getFullYear() ? ' de ' + s.getFullYear() : '');
    return a + ' – ' + e.getDate() + ' de ' + MESES3[e.getMonth()] + '. de ' + e.getFullYear();
  }
  function renderToolbar() {
    $('range').textContent = rangeLabel();
    var bs = $('views').querySelectorAll('button');
    for (var i = 0; i < bs.length; i++) bs[i].className = (!query && bs[i].getAttribute('data-view') === mode) ? 'on' : '';
  }

  // ---------- semana e dia ----------
  function layout(list) {
    list.sort(function (a, b) { return a.s - b.s || b.en - a.en; });
    var groups = [], cur = null, end = 0;
    list.forEach(function (it) {
      if (!cur || it.s >= end) { cur = { items: [], cols: [] }; groups.push(cur); end = 0; }
      var c = 0;
      while (cur.cols[c] !== undefined && cur.cols[c] > it.s) c++;
      cur.cols[c] = it.en; it.col = c; cur.items.push(it); end = Math.max(end, it.en);
    });
    groups.forEach(function (g) { g.items.forEach(function (it) { it.n = g.cols.length; }); });
  }
  function tzInfo() {
    var off = -new Date().getTimezoneOffset() / 60;
    return { top: off === -3 ? 'BRT' : '', gmt: 'GMT' + (off >= 0 ? '+' : '-') + Math.abs(off) };
  }

  function renderTime(host) {
    var days = [], i;
    if (mode === 'day') days = [new Date(sel)];
    else { var s = startOfWeek(sel); for (i = 0; i < 7; i++) days.push(addDays(s, i)); }
    var n = days.length, tk = fmt(today), tz = tzInfo();

    var head = '<div class="gr"><div class="hd corner"></div>';
    days.forEach(function (d) {
      var k = fmt(d);
      head += '<div class="hd' + (k === tk ? ' today' : '') + '" data-goto="' + k + '"><span class="wd">' + DIAS3[d.getDay()] + '</span><span class="dn">' + d.getDate() + '</span></div>';
    });
    head += '<div class="hd corner tzc"><span>' + tz.top + '</span><span>' + tz.gmt + '</span></div></div>';

    var any = false;
    var adCells = days.map(function (d) {
      var k = fmt(d), s = '', h = holidayOf(k);
      if (h) { any = true; s += '<div class="chip hol">' + esc(h) + '</div>'; }
      eventsOn(k).forEach(function (e) {
        if (e.allDay) { any = true; s += '<button class="chip solid" data-id="' + e.id + '" style="' + tone(e.color) + '">' + esc(e.title) + '</button>'; }
      });
      return '<div class="adc">' + s + '</div>';
    });
    var allday = any ? '<div class="gr ad"><div class="adl">dia todo</div>' + adCells.join('') + '<div class="tzc"></div></div>' : '';

    var labels = '';
    for (var h = 1; h < 24; h++) labels += '<span style="top:' + (h / 24 * 100) + '%">' + pad(h) + ':00</span>';

    var earliest = 7;
    var cols = days.map(function (d) {
      var k = fmt(d);
      var list = eventsOn(k).filter(function (e) { return !e.allDay; }).map(function (e) {
        var s0 = toMin(e.start);
        return { e: e, s: s0, en: Math.max(toMin(e.end || e.start), s0) };
      });
      layout(list);
      var html = '<div class="dcol' + (k === tk ? ' today' : '') + '" data-date="' + k + '">';
      list.forEach(function (it) {
        var dur = it.en - it.s;
        earliest = Math.min(earliest, Math.floor(it.s / 60));
        html += '<button class="ev' + (dur <= 45 ? ' sm' : '') + '" data-id="' + it.e.id + '" style="' + tone(it.e.color) +
          ';top:' + (it.s / 14.4) + '%;height:' + (Math.max(dur, 15) / 14.4) + '%;left:calc(' + (it.col / it.n * 100) +
          '% + 1px);width:calc(' + (100 / it.n) + '% - 3px)"><span class="et">' + it.e.start + '</span><span class="en">' + esc(it.e.title) + '</span></button>';
      });
      if (k === tk) html += '<div class="now" style="top:' + (nowMin() / 14.4) + '%"></div>';
      return html + '</div>';
    });

    host.innerHTML = '<div class="tscroll"><div class="tv" style="--n:' + n + ';--minw:' + (mode === 'day' ? '0' : '46rem') + '">' +
      '<div class="sticky">' + head + allday + '</div>' +
      '<div class="gr body"><div class="tcol">' + labels + '</div>' + cols.join('') + '<div class="tcol r">' + labels + '</div></div></div></div>';

    var sc = host.querySelector('.tscroll'), body = sc.querySelector('.body');
    var hp = body.offsetHeight / 24;
    if (scrollHour === null) scrollHour = Math.max(0, earliest - 0.3);
    sc.scrollTop = scrollHour * hp;
    sc.addEventListener('scroll', function () { scrollHour = sc.scrollTop / hp; });
  }

  // ---------- mês ----------
  function renderMonth(host) {
    var y = sel.getFullYear(), m = sel.getMonth();
    var first = new Date(y, m, 1), dim = new Date(y, m + 1, 0).getDate();
    var rows = Math.ceil((first.getDay() + dim) / 7), start = addDays(first, -first.getDay());
    var rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    var h = host.clientHeight, limit = 3;
    if (h > 0) limit = Math.max(1, Math.floor(((h - 2 * rem) / rows - 2.4 * rem) / (1.2 * rem + 2)));
    var tk = fmt(today), html = '<div class="mv"><div class="mwd">';
    DIAS3.forEach(function (d) { html += '<span>' + d + '</span>'; });
    html += '</div><div class="mgrid" style="--rows:' + rows + '">';
    for (var i = 0; i < rows * 7; i++) {
      var d = addDays(start, i), k = fmt(d), hol = holidayOf(k), items = [];
      if (hol) items.push({ hol: hol });
      eventsOn(k).forEach(function (e) { items.push({ e: e }); });
      html += '<div class="mcell' + (d.getMonth() !== m ? ' out' : '') + (k === tk ? ' today' : '') + (hol ? ' hol' : '') + '" data-date="' + k + '">' +
        '<button class="mnum" data-goto="' + k + '">' + d.getDate() + '</button>';
      var shown = items.length > limit ? Math.max(1, limit - 1) : items.length;
      items.slice(0, shown).forEach(function (it) {
        if (it.hol) html += '<div class="chip hol">' + esc(it.hol) + '</div>';
        else html += '<button class="chip' + (it.e.allDay ? ' solid' : '') + '" data-id="' + it.e.id + '" style="' + tone(it.e.color) + '">' +
          (it.e.allDay ? '' : it.e.start + ' ') + esc(it.e.title) + '</button>';
      });
      if (items.length > shown) html += '<button class="more" data-goto="' + k + '">+' + (items.length - shown) + ' mais</button>';
      html += '</div>';
    }
    host.innerHTML = html + '</div></div>';
  }

  // ---------- ano ----------
  function renderYear(host) {
    var Y = sel.getFullYear(), tk = fmt(today), has = {}, html = '<div class="yv">';
    events.forEach(function (e) { has[e.date] = true; });
    for (var m = 0; m < 12; m++) {
      var first = new Date(Y, m, 1), dim = new Date(Y, m + 1, 0).getDate();
      html += '<div class="ym"><button class="ym-t' + (today.getFullYear() === Y && today.getMonth() === m ? ' cur' : '') + '" data-gotom="' + Y + '-' + m + '">' + cap(MESES[m]) + '</button><div class="yg">';
      DIAS1.forEach(function (c) { html += '<span class="w">' + c + '</span>'; });
      for (var b = 0; b < first.getDay(); b++) html += '<span></span>';
      for (var d = 1; d <= dim; d++) {
        var k = Y + '-' + pad(m + 1) + '-' + pad(d);
        html += '<button class="yd' + (k === tk ? ' today' : '') + (has[k] ? ' has' : '') + '" data-goto="' + k + '"><span>' + d + '</span></button>';
      }
      html += '</div></div>';
    }
    host.innerHTML = html + '</div>';
  }

  // ---------- busca ----------
  function renderSearch(host) {
    var q = query.toLowerCase();
    var res = events.filter(function (e) { return (e.title + ' ' + e.note).toLowerCase().indexOf(q) > -1; })
      .sort(function (a, b) { return a.date.localeCompare(b.date) || sortEv(a, b); });
    var html = '<div class="sv">';
    if (!res.length) html += '<div class="empty">Nenhum resultado para “' + esc(query) + '”.</div>';
    res.forEach(function (e) {
      var d = parse(e.date);
      html += '<button class="sr" data-id="' + e.id + '"><i style="background:' + e.color + '"></i><span class="sd">' +
        d.getDate() + ' ' + MESES3[d.getMonth()] + ' ' + d.getFullYear() + ' · ' + DIAS3[d.getDay()].toLowerCase() +
        '</span><span class="st">' + timeText(e) + '</span><span class="sn">' + esc(e.title) + '</span></button>';
    });
    host.innerHTML = html + '</div>';
  }

  // ---------- render geral ----------
  function render() {
    renderMini();
    renderAgenda();
    renderToolbar();
    var host = $('view');
    if (query) renderSearch(host);
    else if (mode === 'month') renderMonth(host);
    else if (mode === 'year') renderYear(host);
    else renderTime(host);
  }

  // ---------- navegação ----------
  function syncMini() { mini = { y: sel.getFullYear(), m: sel.getMonth() }; }
  function clearSearch() { query = ''; $('search').value = ''; }
  function setMode(m) { mode = m; lsSet(VKEY, m); clearSearch(); render(); }
  function step(dir) {
    clearSearch();
    if (mode === 'day') sel = addDays(sel, dir);
    else if (mode === 'week') sel = addDays(sel, 7 * dir);
    else if (mode === 'month') sel = addMonths(sel, dir);
    else sel = addMonths(sel, 12 * dir);
    syncMini(); render();
  }
  function toggleSide(open) {
    var app = $('app');
    if (open === undefined) open = !app.classList.contains('side-open');
    app.classList.toggle('side-open', open);
  }

  // ---------- diálogo de evento ----------
  function buildColors() {
    var box = $('f-colors'); box.innerHTML = '';
    COLORS.forEach(function (c) {
      var l = document.createElement('label'), r = document.createElement('input'), s = document.createElement('span');
      r.type = 'radio'; r.name = 'cor'; r.value = c; r.checked = (c === chosenColor);
      r.addEventListener('change', function () { chosenColor = c; });
      s.style.background = c; l.appendChild(r); l.appendChild(s); box.appendChild(l);
    });
  }
  function syncAll() { var a = $('f-all').checked; $('f-start').disabled = a; $('f-end').disabled = a; }
  var delArmed = false, delTimer = null;
  function resetDel() { delArmed = false; clearTimeout(delTimer); $('f-del').textContent = 'Excluir'; }
  function fill(e) {
    $('f-title').value = e.title; $('f-date').value = e.date; $('f-all').checked = e.allDay;
    $('f-start').value = e.start || '09:00'; $('f-end').value = e.end || addMin(e.start || '09:00', 60);
    $('f-note').value = e.note || ''; chosenColor = e.color || COLORS[0];
    buildColors(); syncAll();
  }
  function openDlg() { var d = $('dlg'); if (!d.open) d.showModal(); }
  function openNew(k, start, end, allDay) {
    editingId = null; resetDel();
    fill({ title: '', date: k, start: start || '09:00', end: end || '10:00', allDay: !!allDay, color: COLORS[0], note: '' });
    $('dlg-title').textContent = 'Novo evento'; $('f-del').hidden = true; openDlg();
  }
  function openEdit(id) {
    var e = events.filter(function (x) { return x.id === id; })[0];
    if (!e) return;
    editingId = id; resetDel(); fill(e);
    $('dlg-title').textContent = 'Editar evento'; $('f-del').hidden = false; openDlg();
  }
  function newFromButton() {
    var k = fmt(sel), s = '09:00';
    if (k === fmt(today)) s = toTime(Math.min(23, new Date().getHours() + 1) * 60);
    openNew(k, s, addMin(s, 60), false);
  }

  $('form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var title = $('f-title').value.trim(); if (!title) return;
    var allDay = $('f-all').checked, start = '', end = '';
    if (!allDay) {
      start = $('f-start').value || '09:00'; end = $('f-end').value;
      if (!end || toMin(end) <= toMin(start)) end = addMin(start, 60);
    }
    var data = { title: title, date: $('f-date').value, allDay: allDay, start: start, end: end, note: $('f-note').value.trim(), color: chosenColor };
    if (editingId) events = events.map(function (x) { return x.id === editingId ? Object.assign({}, x, data) : x; });
    else { data.id = uid(); events.push(data); }
    saveEvents(); $('dlg').close(); render();
  });
  $('f-all').addEventListener('change', syncAll);
  $('f-cancel').addEventListener('click', function () { $('dlg').close(); });
  $('dlg-close').addEventListener('click', function () { $('dlg').close(); });
  $('dlg').addEventListener('click', function (e) { if (e.target === $('dlg')) $('dlg').close(); });
  $('dlg').addEventListener('close', resetDel);
  $('f-del').addEventListener('click', function () {
    if (!delArmed) { delArmed = true; this.textContent = 'Confirmar exclusão'; delTimer = setTimeout(resetDel, 3000); return; }
    events = events.filter(function (x) { return x.id !== editingId; });
    saveEvents(); $('dlg').close(); render();
  });

  // ---------- eventos da interface ----------
  $('view').addEventListener('click', function (e) {
    var t = e.target, el;
    if ((el = t.closest('[data-id]'))) { openEdit(el.getAttribute('data-id')); return; }
    if ((el = t.closest('[data-gotom]'))) {
      var p = el.getAttribute('data-gotom').split('-');
      sel = new Date(+p[0], +p[1], 1); syncMini(); setMode('month'); return;
    }
    if ((el = t.closest('[data-goto]'))) { sel = parse(el.getAttribute('data-goto')); syncMini(); setMode('day'); return; }
    if ((el = t.closest('.dcol'))) {
      var r = el.getBoundingClientRect(), min = Math.floor((e.clientY - r.top) / r.height * 48) * 30;
      openNew(el.getAttribute('data-date'), toTime(min), toTime(min + 60), false); return;
    }
    if ((el = t.closest('.mcell'))) { openNew(el.getAttribute('data-date'), '09:00', '10:00', false); }
  });
  $('agenda').addEventListener('click', function (e) {
    var el = e.target.closest('[data-id]'); if (el) openEdit(el.getAttribute('data-id'));
  });
  $('mini-grid').addEventListener('click', function (e) {
    var b = e.target.closest('.md'); if (!b) return;
    sel = parse(b.getAttribute('data-date')); syncMini(); clearSearch();
    if (mode === 'year') setMode('day'); else render();
    toggleSide(false);
  });
  $('mini-prev').addEventListener('click', function () { mini = { y: mini.m === 0 ? mini.y - 1 : mini.y, m: (mini.m + 11) % 12 }; renderMini(); });
  $('mini-next').addEventListener('click', function () { mini = { y: mini.m === 11 ? mini.y + 1 : mini.y, m: (mini.m + 1) % 12 }; renderMini(); });
  $('prev').addEventListener('click', function () { step(-1); });
  $('next').addEventListener('click', function () { step(1); });
  $('today').addEventListener('click', function () { today = dateOnly(new Date()); sel = new Date(today); syncMini(); clearSearch(); render(); });
  $('views').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (b) setMode(b.getAttribute('data-view'));
  });
  $('add').addEventListener('click', function () { toggleSide(false); newFromButton(); });
  $('menu').addEventListener('click', function () { toggleSide(); });
  $('scrim').addEventListener('click', function () { toggleSide(false); });
  $('search').addEventListener('input', function () { query = this.value.trim(); render(); });
  $('search').addEventListener('keydown', function (e) { if (e.key === 'Escape') { clearSearch(); render(); } });

  // semana do mini calendário
  DIAS3.forEach(function (d) { var s = document.createElement('span'); s.textContent = d; $('mini-wd').appendChild(s); });

  // botão voltar do Android
  window.__back = function () {
    if ($('dlg').open) { $('dlg').close(); return true; }
    if ($('app').classList.contains('side-open')) { toggleSide(false); return true; }
    if (query) { clearSearch(); render(); return true; }
    return false;
  };

  // atualiza a linha de "agora" e a data quando o dia vira
  setInterval(function () {
    if (fmt(dateOnly(new Date())) !== fmt(today)) { today = dateOnly(new Date()); render(); return; }
    var el = document.querySelector('.now');
    if (el) el.style.top = (nowMin() / 14.4) + '%';
  }, 60000);
  var rt = null;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { if (mode === 'month' && !query && !$('dlg').open) render(); }, 150);
  });

  render();
})();
