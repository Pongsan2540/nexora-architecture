/* map.js — Page-specific logic */
/* Shared utilities: ../js/glassui.js */
// ── Auth Guard ──
// if (!sessionStorage.getItem('nexora_auth')) {
//   document.documentElement.style.visibility = 'hidden';
//   setTimeout(() => window.location.href = '../pages/blackhole-login.html', 0);
// }

// // ── Prevent back button cache ──
// window.addEventListener('pageshow', (e) => {
//   if (e.persisted || !sessionStorage.getItem('nexora_auth')) {
//     document.documentElement.style.visibility = 'hidden';
//     window.location.href = '../pages/blackhole-login.html';
//   }
// });

const BASE_URL = "http://localhost:8001/nexora/api";

// ── Auto Logout on Idle (30 minutes) ──
let idleTimer;
const IDLE_LIMIT = 30 * 60 * 1000;

function resetIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    sessionStorage.removeItem('nexora_auth');
    window.location.href = '../pages/blackhole-login.html';
  }, IDLE_LIMIT);
}

['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(evt => {
  window.addEventListener(evt, resetIdle);
});

resetIdle();

(function(){
    /* PAGE TRANSITION */
    const veil = document.getElementById('pageVeil');
    function navigateTo(url){ veil.classList.add('in'); setTimeout(()=>location.href=url,430); }
    window.navigateTo = navigateTo;
    veil.classList.add('in');
    requestAnimationFrame(()=>requestAnimationFrame(()=>veil.classList.remove('in')));

    const root = document.documentElement;
    let dark = true;
    let is3d = false;
    let currentKey = 'dark';
    const glMarkers = [];
    let isSelectingCoord = false;

    /* ── MAP STYLES ── */
    const STYLES = {
      dark:     'https://tiles.openfreemap.org/styles/dark',
      streets:  'https://tiles.openfreemap.org/styles/bright',
      topo:     'https://tiles.openfreemap.org/styles/positron',
      positron: 'https://tiles.openfreemap.org/styles/positron',
      liberty:  'https://tiles.openfreemap.org/styles/liberty',
    };

    /* ── PLACES — with rich data ── */
     /*
    let PLACES = [4
      {
        name:'Wat Phra Kaew', sub:'Grand Palace, Bangkok',
        lat:13.7516, lng:100.4918, tag:'Heritage',
        img:'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Wat_Phra_Kaew_3.jpg/1280px-Wat_Phra_Kaew_3.jpg',
        desc:'The Temple of the Emerald Buddha — Thailand\'s most sacred Buddhist temple, built in 1782 within the Grand Palace grounds.',
        hours:'08:30 – 15:30', admission:'500 THB',
        events:[
          {icon:'🏮', name:'Royal Ceremony', time:'Sat, 15 Mar · 09:00', badge:'Official', img:'../logo/icon/icon-search.avif',
            venue:'Wat Phra Kaew', adm:'Included (500 THB)', desc:'A sacred royal ceremony held at the Temple of the Emerald Buddha.', tags:['Royal','Buddhist','Cultural']},
        ]
      },
      {
        name:'Chatuchak Market', sub:'Bangkok',
        lat:13.7999, lng:100.5500, tag:'Shopping',
        img:'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Chatuchak_market.jpg/1280px-Chatuchak_market.jpg',
        desc:'The world\'s largest weekend market with over 15,000 stalls spanning 35 acres.',
        hours:'09:00 – 18:00 (Sat–Sun)', admission:'Free',
        events:[]
      }
    ];
    */

    let PLACES = [];
    let EVENTS = [];

    async function loadPlaces() {
      try {
        const res = await fetch(`${BASE_URL}/listPlaces`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();

        PLACES = Array.isArray(data) ? data : (data.places || []);

        renderEventsList();
        // renderPlaces();
        // renderMarkers();
      } catch (error) {
        console.error("โหลดข้อมูล places ไม่สำเร็จ:", error);
        PLACES = [];
      }
    }

    async function loadEvents() {
      try {
        const res = await fetch(`${BASE_URL}/listEvents`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        EVENTS = Array.isArray(data) ? data : (data.events || []);
        renderEventsList();
      } catch (error) {
        console.error("โหลดข้อมูล events ไม่สำเร็จ:", error);
        EVENTS = [];
        renderEventsList();
      }
    }

    document.addEventListener("DOMContentLoaded", async () => {
      await loadPlaces();
      await loadEvents();
    });

    /* ── SAVE PLACES TO LOCALSTORAGE ── */
    function savePlacesLocal() {
      localStorage.setItem('mapPlaces', JSON.stringify(PLACES));
    }

    /* ── DARK MODE BRIGHTNESS BOOST ── */
    function boostDark() {
      if (!['dark','liberty'].includes(currentKey)) return;
      const style = map.getStyle();
      if (!style) return;

      style.layers.forEach(l => {
        try {
          if (l.type === 'background') {
            map.setPaintProperty(l.id, 'background-color', '#2a2520');
          }
          if (l.type === 'fill') {
            map.setPaintProperty(l.id, 'fill-opacity',
              ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0.95]);
          }
          if (l.type === 'line') {
            map.setPaintProperty(l.id, 'line-opacity', 0.9);
          }
        } catch(e) {}
      });

      const canvas = map.getCanvas();
      canvas.style.filter = 'brightness(1.55) contrast(0.92) saturate(0.75)';
    }

    function clearBoost() {
      const canvas = map.getCanvas();
      canvas.style.filter = 'brightness(1.0) contrast(1.0) saturate(1.0)';
    }

    /* ── INIT MAP ── */
    const map = new maplibregl.Map({
      container: 'map',
      style: STYLES.dark,
      center: [100.5018, 13.7563],
      zoom: 14,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    });

    map.on('load', () => {
      if (dark) boostDark(); else clearBoost();
      add3DLayer();
      addAllMarkers();
      renderPlacesList();
      renderEventsList();
    });

    /* ── 3D BUILDINGS LAYER ── */
    function add3DLayer() {
      if (map.getLayer('3d-buildings')) return;
      const layers = map.getStyle().layers;
      let firstLabel;
      for (const l of layers) {
        if (l.type === 'symbol' && l.layout?.['text-field']) { firstLabel = l.id; break; }
      }
      try {
        map.addLayer({
          id: '3d-buildings',
          source: 'building',
          'source-layer': 'building',
          type: 'fill-extrusion',
          minzoom: 14,
          layout: { visibility: 'none' },
          paint: {
            'fill-extrusion-color': dark ? '#38322a' : '#d8d2ca',
            'fill-extrusion-height': [
              'interpolate',['linear'],['zoom'],
              14,0,
              14.1,['coalesce',['get','height'],['*',['coalesce',['get','levels'],1],3.5],8]
            ],
            'fill-extrusion-base': ['coalesce',['get','min_height'],0],
            'fill-extrusion-opacity': 0.9,
            'fill-extrusion-ambient-occlusion-intensity': 0.4,
          },
        }, firstLabel);
      } catch(e) { console.warn('3D layer:', e.message); }
    }

    /* ── LAYER SWITCH ── */
    function switchStyle(key) {
      currentKey = key;
      dark = (key === 'dark' || key === 'liberty');
      root.setAttribute('data-theme', dark ? 'dark' : 'light');
      document.querySelectorAll('.lbtn').forEach(b => b.classList.toggle('active', b.dataset.key === key));
      map.setStyle(STYLES[key]);
      map.once('styledata', () => {
        if (dark) boostDark(); else clearBoost();
        add3DLayer();
        if (is3d) {
          try { map.setLayoutProperty('3d-buildings','visibility','visible'); } catch(e){}
        }
        reAddMarkers();
      });
    }

    document.querySelectorAll('.lbtn').forEach(btn =>
      btn.addEventListener('click', () => switchStyle(btn.dataset.key))
    );

    /* ── THEME BTN ── */
    document.getElementById('themeBtn').addEventListener('click', () => {
      switchStyle(dark ? 'streets' : 'dark');
    });

    /* ── 3D TOGGLE ── */
    const btn3d = document.getElementById('btn3d');
    btn3d.addEventListener('click', () => {
      is3d = !is3d;
      btn3d.classList.toggle('on', is3d);
      if (is3d) {
        map.easeTo({ pitch:55, bearing:-22, duration:900, easing:t=>1-Math.pow(1-t,3) });
        try { map.setLayoutProperty('3d-buildings','visibility','visible'); } catch(e){}
      } else {
        map.easeTo({ pitch:0, bearing:0, duration:700 });
        try { map.setLayoutProperty('3d-buildings','visibility','none'); } catch(e){}
      }
    });

    /* ── RESET ── */
    document.getElementById('btnReset').addEventListener('click', () => {
      is3d = false; btn3d.classList.remove('on');
      try { map.setLayoutProperty('3d-buildings','visibility','none'); } catch(e){}
      map.easeTo({ center:[100.5018,13.7563], zoom:14, pitch:0, bearing:0, duration:800 });
    });

    document.getElementById('btnZoomIn').addEventListener('click',  () => map.zoomIn({duration:300}));
    document.getElementById('btnZoomOut').addEventListener('click', () => map.zoomOut({duration:300}));

    /* ── COORD BAR ── */
    const coordBar = document.getElementById('coordBar');
    map.on('mousemove', e => {
      const {lat,lng} = e.lngLat;
      coordBar.textContent = `${lat.toFixed(4)}° N  ${lng.toFixed(4)}° E`;
    });

    /* ── HAVERSINE DISTANCE ── */
    const CTR = {lat:13.7563, lng:100.5018};
    function hav(p1, p2) {
      const R = 6371, dLat = (p2.lat - p1.lat)*Math.PI/180,
        dLng = (p2.lng - p1.lng)*Math.PI/180,
        a = Math.sin(dLat/2)*Math.sin(dLat/2) +
            Math.cos(p1.lat*Math.PI/180)*Math.cos(p2.lat*Math.PI/180)*
            Math.sin(dLng/2)*Math.sin(dLng/2),
        c = 2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
      return (R*c).toFixed(1);
    }

    /* ── ADD PLACE MODAL ── */
    const addPlaceBackdrop = document.getElementById('addPlaceBackdrop');
    const addPlaceModal = document.getElementById('addPlaceModal');
    const btnAddPlace = document.getElementById('btnAddPlace');
    const formAddPlace = document.getElementById('formAddPlace');
    const closeAddPlaceBtn = document.getElementById('closeAddPlace');
    const btnPickCoord = document.getElementById('btnPickCoord');
    const coordStatus = document.getElementById('coordStatus');

    btnAddPlace?.addEventListener('click', () => {
      addPlaceBackdrop.classList.add('open');
      addPlaceModal.classList.add('open');
    });

    function closeAddPlaceModal() {
      addPlaceBackdrop.classList.remove('open');
      addPlaceModal.classList.remove('open');
      isSelectingCoord = false;
      if (btnPickCoord) btnPickCoord.classList.remove('active');
      if (coordStatus) coordStatus.textContent = 'Click button to pick from map';
      formAddPlace.reset();
      map.off('click', onMapClickForCoord);
      map.getCanvas().style.cursor = '';
    }

    closeAddPlaceBtn?.addEventListener('click', closeAddPlaceModal);
    addPlaceBackdrop?.addEventListener('click', closeAddPlaceModal);

    function onMapClickForCoord(e) {
      if (!isSelectingCoord) return;
      
      const lat = e.lngLat.lat.toFixed(4);
      const lng = e.lngLat.lng.toFixed(4);
      
      document.getElementById('addPlaceLat').value = lat;
      document.getElementById('addPlaceLng').value = lng;
      
      if (coordStatus) coordStatus.textContent = `✅ Picked: ${lat}°, ${lng}°`;
      if (btnPickCoord) btnPickCoord.classList.remove('active');
      
      isSelectingCoord = false;
      map.off('click', onMapClickForCoord);
      map.getCanvas().style.cursor = '';
    }

    btnPickCoord?.addEventListener('click', () => {
      isSelectingCoord = !isSelectingCoord;
      btnPickCoord.classList.toggle('active', isSelectingCoord);
      
      if (isSelectingCoord) {
        if (coordStatus) coordStatus.textContent = '🎯 Click on map to pick location...';
        map.on('click', onMapClickForCoord);
        map.getCanvas().style.cursor = 'crosshair';
      } else {
        if (coordStatus) coordStatus.textContent = 'Click button to pick from map';
        map.off('click', onMapClickForCoord);
        map.getCanvas().style.cursor = '';
      }
    });

    formAddPlace?.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const newPlace = {
        name: document.getElementById('addPlaceName').value,
        sub: document.getElementById('addPlaceSub').value,
        lat: parseFloat(document.getElementById('addPlaceLat').value),
        lng: parseFloat(document.getElementById('addPlaceLng').value),
        tag: document.getElementById('addPlaceTag').value,
        img: document.getElementById('addPlaceImg').value || 'https://via.placeholder.com/800x400?text=No+Image',
        desc: document.getElementById('addPlaceDesc').value,
        hours: document.getElementById('addPlaceHours').value,
        level: document.getElementById('addPlaceLevel').value,
        events: []
      }; 

      if (!newPlace.name || isNaN(newPlace.lat) || isNaN(newPlace.lng)) {
        alert('Please fill in: Name, Latitude, Longitude');
        return;
      }

      if (newPlace.lat < -90 || newPlace.lat > 90) {
        alert('Latitude must be between -90 and 90');
        return;
      }

      if (newPlace.lng < -180 || newPlace.lng > 180) {
        alert('Longitude must be between -180 and 180');
        return;
      }

      try {
        const res = await fetch(`${BASE_URL}/addPlaces`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(newPlace)
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        await loadPlaces();
        await loadEvents();
        closeAddPlaceModal();
        alert('✅ Place added!');
        location.reload();
      } catch (error) {
        await loadEvents();
        console.error("โหลดข้อมูล places ไม่สำเร็จ:", error);
        alert("❌ Save ไม่สำเร็จ");
      }
    });

    /* ── POPUP ── */
    const popup    = document.getElementById('pin-popup');
    const popInner = popup.querySelector('.pop-inner');
    let activeIdx  = -1;

    document.getElementById('pop-close').addEventListener('click', e => {
      e.stopPropagation(); closePlace();
    });
    popup.addEventListener('click', e => e.stopPropagation());

    function showPopup(i) {
      const p = PLACES[i];
      document.getElementById('pop-tag').textContent   = p.tag;
      document.getElementById('pop-name').textContent  = p.name;
      document.getElementById('pop-sub').textContent   = p.sub;
      document.getElementById('pop-coord').textContent = `${p.lat.toFixed(4)}° N, ${p.lng.toFixed(4)}° E`;
      document.getElementById('pop-dist').textContent  = `${hav(CTR,p)} km from center`;
      popup.classList.add('show');
      positionPopup(i);
    }

    function positionPopup(i) {
      if (activeIdx < 0 || !popup.classList.contains('show')) return;
      const p  = PLACES[i];
      const pt = map.project([p.lng, p.lat]);
      const pw = popInner.offsetWidth  || 220;
      const ph = popInner.offsetHeight || 130;
      const GAP = 8;
      popup.style.left = Math.round(pt.x - pw / 2) + 'px';
      popup.style.top  = Math.round(pt.y - ph - GAP) + 'px';
    }

    map.on('move', () => { if (activeIdx >= 0) positionPopup(activeIdx); });

    /* ── MARKERS ── */
    function mkMarker(i) {
      const el = document.createElement('div');
      el.className = 'pin-wrap';
      el.innerHTML = `
        <svg class="pin-svg" viewBox="0 0 28 38" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path class="pin-body" d="M14 1C7.925 1 3 5.925 3 12c0 8.5 11 25 11 25S25 20.5 25 12C25 5.925 20.075 1 14 1z"
            fill="#8a7e6e" stroke="rgba(255,255,255,0.45)" stroke-width="1.5"/>
          <circle cx="14" cy="12" r="4.5" fill="rgba(255,255,255,0.32)"/>
        </svg>`;
      el.addEventListener('click', e => { e.stopPropagation(); focusPlace(i); });
      return el;
    }

    function setMarkerActive(i) {
      activeIdx = i;
      document.querySelectorAll('.pin-wrap').forEach((el, j) => {
        el.classList.toggle('active', j === i);
        const body = el.querySelector('.pin-body');
        if (body) body.setAttribute('fill', j === i ? '#c0a882' : '#8a7e6e');
      });
    }

    function closePlace() {
      activeIdx = -1;
      popup.classList.remove('show');
      setMarkerActive(-1);
      document.querySelectorAll('.loc-item').forEach(el => el.classList.remove('active'));
      infoCard.classList.remove('visible');
    }

    function addAllMarkers() {
      glMarkers.forEach(m=>m.remove()); glMarkers.length=0;
      PLACES.forEach((p,i) => {
        const m = new maplibregl.Marker({
          element: mkMarker(i),
          anchor: 'center',
          offset: [0, 19],
        })
        .setLngLat([p.lng, p.lat]).addTo(map);
        glMarkers.push(m);
      });
    }

    function reAddMarkers() {
      glMarkers.forEach(m=>m.remove()); glMarkers.length=0;
      PLACES.forEach((_,i) => {
        const m = new maplibregl.Marker({
          element: mkMarker(i),
          anchor: 'center',
          offset: [0, 19],
        })
        .setLngLat([PLACES[i].lng, PLACES[i].lat]).addTo(map);
        glMarkers.push(m);
      });
    }

    /* ── EVENT DETAIL MODAL ── */
    const evBackdrop = document.getElementById('evBackdrop');
    const evModal    = document.getElementById('evModal');

    function openEvModal(ev, placeName) {
      const modalImg = document.getElementById('evModalImg');
      const fallbackImg = '../logo/icon/icon-search.avif';

      const rawImg = ev.img || ev.image || '';
      const safeImg = rawImg ? rawImg.replace('/120/80', '/800/400') : fallbackImg;

      modalImg.src = safeImg;
      modalImg.onerror = function () {
        this.onerror = null;
        this.src = fallbackImg;
      };

      const title = ev.name || ev.title || 'Untitled';
      const place = placeName || ev.placeName || ev.place || ev.venue || ev.sub || 'Unknown Place';
      const time = ev.time || ev.hours || '-';
      const category = ev.badge || ev.tag || 'Event';
      const venue = ev.venue || ev.placeName || ev.place || ev.sub || 'Unknown Place';
      const level = ev.adm || ev.level || 'Free';
      const desc = ev.desc || ev.description || '—';
      const tags = ev.tags || (ev.tag ? [ev.tag] : []);

      document.getElementById('evModalTitle').textContent = title;
      document.getElementById('evModalPlace').textContent = place;
      document.getElementById('evModalTime').textContent = time;
      document.getElementById('evModalBadge').textContent = category;
      document.getElementById('evModalVenue').textContent = venue;
      document.getElementById('evModalAdm').textContent = level;
      document.getElementById('evModalDesc').textContent = desc;
      document.getElementById('evModalTags').innerHTML = tags
        .map(t => `<span class="ev-modal-tag">${t}</span>`)
        .join('');

      evBackdrop.classList.add('open');
      evModal.classList.add('open');
    }

    function closeEvModal() {
      evBackdrop.classList.remove('open');
      evModal.classList.remove('open');
      document.querySelectorAll('.ev-item').forEach(el => el.classList.remove('active'));
    }

    document.getElementById('evModalClose').addEventListener('click', closeEvModal);
    evBackdrop.addEventListener('click', closeEvModal);

    /* ── RIGHT PANEL — event records ── */
    function renderEventsList() {
      const evItemsEl = document.getElementById('evItems');
      evItemsEl.innerHTML = '';

      if (!EVENTS.length) {
        evItemsEl.innerHTML = `<div class="ev-empty">No event records found.</div>`;
        return;
      }

      EVENTS.forEach(ev => {
        const placeName =
          ev.placeName ||
          ev.place ||
          ev.venue ||
          ev.sub ||
          'Unknown Place';

        const badge =
          ev.badge ||
          ev.tag ||
          'Event';

        const timeText =
          ev.time ||
          ev.hours ||
          '-';

        const el = document.createElement('div');
        el.className = 'ev-item';
        el.innerHTML = `
          <img class="ev-thumb"
              src="${ev.img || '../logo/icon/icon-search.avif'}"
              alt="${ev.name || 'Event'}"
              loading="lazy"
              onerror="this.onerror=null;this.src='../logo/icon/icon-search.avif';"/>
          <div class="ev-info">
            <div class="ev-name">${ev.name || 'Untitled Event'}</div>
            <div class="ev-sub">${placeName} · ${timeText}</div>
          </div>
          <div class="ev-badge">${badge}</div>`;

        el.addEventListener('click', () => {
          document.querySelectorAll('.ev-item').forEach(e => e.classList.remove('active'));
          el.classList.add('active');
          openEvModal(ev, placeName);
        });

        evItemsEl.appendChild(el);
      });
    }

    /* ── PLACE LIST ── */
    const locItemsEl = document.getElementById('locItems');
    const infoCard   = document.getElementById('infoCard');

    function renderPlacesList() {
      locItemsEl.innerHTML = '';
      PLACES.forEach((p,i) => {
        const el = document.createElement('div'); 
        el.className='loc-item';
        el.innerHTML=`<div class="loc-dot"></div>
          <div class="loc-info"><div class="loc-name">${p.name}</div><div class="loc-sub">${p.sub}</div></div>
          <div class="loc-dist">${hav(CTR,p)}km</div>`;
        el.addEventListener('click', ()=>focusPlace(i));
        locItemsEl.appendChild(el);
      });
    }

    function focusPlace(i) {
      const p = PLACES[i];
      document.querySelectorAll('.loc-item').forEach((el,j) => el.classList.toggle('active', j===i));
      setMarkerActive(i);
      showPopup(i);
      map.flyTo({center:[p.lng,p.lat], zoom:16, pitch:is3d?55:12, bearing:is3d?-18:0, duration:1200, essential:true});
      document.getElementById('infoTitle').textContent = p.name;
      document.getElementById('infoSub').textContent   = p.sub;
      document.getElementById('infoCoord').textContent = `${p.lat.toFixed(4)}° N, ${p.lng.toFixed(4)}° E`;
      document.getElementById('infoTime').textContent  = `${hav(CTR,p)} km from center`;
      document.getElementById('infoTag').textContent   = p.tag;
      infoCard.classList.add('visible');
    }

    document.getElementById('infoClose').addEventListener('click', ()=>closePlace());

    document.getElementById('searchInput').addEventListener('input', e=>{
      const q=e.target.value.toLowerCase();
      document.querySelectorAll('.loc-item').forEach((el,i)=>{
        const p=PLACES[i];
        el.style.display=(!q||p.name.toLowerCase().includes(q)||p.sub.toLowerCase().includes(q))?'':'none';
      });
    });

    map.on('click', ()=>closePlace());

  })();