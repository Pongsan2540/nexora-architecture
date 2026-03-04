/* map.js — Page-specific logic */
/* Shared utilities: ../js/glassui.js */

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

    /* ── MAP STYLES (OpenFreeMap — ฟรี ไม่ต้อง key) ── */
    const STYLES = {
      dark:     'https://tiles.openfreemap.org/styles/dark',
      streets:  'https://tiles.openfreemap.org/styles/bright',
      topo:     'https://tiles.openfreemap.org/styles/positron',
      positron: 'https://tiles.openfreemap.org/styles/positron',
      liberty:  'https://tiles.openfreemap.org/styles/liberty',
    };

    /* ── DARK MODE BRIGHTNESS BOOST ──
       Walk every layer in the loaded style and push brightness/opacity up.
       Works by lifting background color and boosting fill + line layer opacities.
    */
    function boostDark() {
      if (!['dark','liberty'].includes(currentKey)) return;
      const style = map.getStyle();
      if (!style) return;

      style.layers.forEach(l => {
        try {
          if (l.type === 'background') {
            // Warm dark base — much lighter than OpenFreeMap default (#0d0b09)
            map.setPaintProperty(l.id, 'background-color', '#2a2520');
          }
          if (l.type === 'fill') {
            // Boost fill-color brightness by setting a higher opacity
            map.setPaintProperty(l.id, 'fill-opacity',
              ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0.95]);
          }
          if (l.type === 'line') {
            map.setPaintProperty(l.id, 'line-opacity', 0.9);
          }
        } catch(e) {}
      });

      // Apply a CSS brightness filter to the entire canvas for a global lift
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

    /* ── PLACES — with rich data ── */
    const PLACES = [
      {
        name:'Wat Phra Kaew', sub:'Grand Palace, Bangkok',
        lat:13.7516, lng:100.4918, tag:'Heritage',
        img:'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Wat_Phra_Kaew_3.jpg/1280px-Wat_Phra_Kaew_3.jpg',
        desc:'The Temple of the Emerald Buddha — Thailand\'s most sacred Buddhist temple, built in 1782 within the Grand Palace grounds. Home to the revered Phra Kaeo Morakot jade statue.',
        hours:'08:30 – 15:30', admission:'500 THB',
        events:[
          {icon:'🏮', name:'Royal Ceremony', time:'Sat, 15 Mar · 09:00', badge:'Official', img:'https://picsum.photos/seed/ceremony/120/80',
            venue:'Wat Phra Kaew', adm:'Included (500 THB)', desc:'A sacred royal ceremony held at the Temple of the Emerald Buddha. Witness traditional Thai rituals performed by Buddhist monks in full ceremonial attire.', tags:['Royal','Buddhist','Cultural']},
          {icon:'🎨', name:'Temple Art Tour', time:'Daily · 10:00 & 14:00', badge:'Free', img:'https://picsum.photos/seed/arttour/120/80',
            venue:'Grand Palace Grounds', adm:'Free with entry', desc:'Guided tour exploring the intricate murals, gilded spires, and symbolic artwork decorating every surface of Wat Phra Kaew. Led by expert art historians.', tags:['Art','History','Guided']},
          {icon:'📸', name:'Photography Walk', time:'Sun, 16 Mar · 07:00', badge:'Guide', img:'https://picsum.photos/seed/photowalk/120/80',
            venue:'Grand Palace', adm:'200 THB', desc:'Early morning golden-hour photography session around the palace grounds. Small group of 8 max. Professional guide with photography tips included.', tags:['Photography','Morning','Small Group']},
        ]
      },
      {
        name:'Chatuchak Market', sub:'Bangkok',
        lat:13.7999, lng:100.5500, tag:'Shopping',
        img:'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Chatuchak_market.jpg/1280px-Chatuchak_market.jpg',
        desc:'The world\'s largest weekend market with over 15,000 stalls spanning 35 acres. A labyrinth of vintage finds, local crafts, street food, and live plants.',
        hours:'Sat–Sun 09:00 – 18:00', admission:'Free',
        events:[
          {icon:'🎵', name:'Live Jazz Corner', time:'Sat, 15 Mar · 14:00', badge:'Free', img:'https://picsum.photos/seed/jazz/120/80',
            venue:'Section 7, Chatuchak', adm:'Free', desc:'Smooth jazz performed by local Bangkok musicians in the shaded courtyard. Bring a blanket and enjoy an afternoon of soulful tunes surrounded by vintage stalls.', tags:['Music','Live','Jazz']},
          {icon:'🍜', name:'Street Food Festival', time:'Sat–Sun · All Day', badge:'Food', img:'https://picsum.photos/seed/streetfood/120/80',
            venue:'Main Food Court', adm:'Free entry', desc:'Over 50 street food vendors showcasing dishes from all 77 Thai provinces. From boat noodles to mango sticky rice — the ultimate Thai food crawl.', tags:['Food','Thai','Weekend']},
          {icon:'🌿', name:'Plant Market Special', time:'Sun, 16 Mar · 08:00', badge:'Market', img:'https://picsum.photos/seed/plants/120/80',
            venue:'Section 2–3', adm:'Free', desc:'Monthly rare plant showcase with collectors and growers from across Thailand. Featuring exotic tropicals, succulents, bonsai, and heirloom seeds.', tags:['Plants','Market','Nature']},
        ]
      },
      {
        name:'Lumpini Park', sub:'Silom, Bangkok',
        lat:13.7287, lng:100.5418, tag:'Nature',
        img:'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Lumphini_Park_Bangkok.jpg/1280px-Lumphini_Park_Bangkok.jpg',
        desc:'Bangkok\'s green lung — a 142-acre urban oasis in the heart of the city, famous for morning tai chi, paddle boats on the lake, and monitor lizards roaming freely.',
        hours:'04:30 – 21:00', admission:'Free',
        events:[
          {icon:'🧘', name:'Morning Yoga Session', time:'Daily · 06:00 – 08:00', badge:'Free', img:'https://picsum.photos/seed/yoga/120/80',
            venue:'East Lawn, Lumpini', adm:'Free', desc:'Open-air yoga and meditation session on the park\'s east lawn, led by certified instructors. All levels welcome. Bring your own mat.', tags:['Yoga','Wellness','Morning']},
          {icon:'🎶', name:'Bangkok Symphony', time:'Fri, 14 Mar · 18:30', badge:'Concert', img:'https://picsum.photos/seed/symphony/120/80',
            venue:'Open-air Stage', adm:'Free', desc:'The Bangkok Symphony Orchestra performs classics under the stars. Gates open at 18:00. Bring a picnic blanket — this annual event draws thousands.', tags:['Music','Classical','Outdoor']},
          {icon:'🚴', name:'Bike & Nature Tour', time:'Sat, 15 Mar · 07:00', badge:'Sport', img:'https://picsum.photos/seed/biketour/120/80',
            venue:'Main Gate, Rama IV', adm:'150 THB', desc:'Guided cycling tour around the park\'s lake and forest paths. Spot monitor lizards, rare birds, and the city skyline. Bikes provided.', tags:['Cycling','Nature','Guided']},
        ]
      },
      {
        name:'Asiatique', sub:'Charoen Krung, Bangkok',
        lat:13.7022, lng:100.4944, tag:'Night Market',
        img:'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Asiatique_The_Riverfront.jpg/1280px-Asiatique_The_Riverfront.jpg',
        desc:'An open-air lifestyle shopping complex on the Chao Phraya riverfront, combining heritage warehouses with 1,500 boutiques, restaurants, and nightly entertainment.',
        hours:'17:00 – 00:00', admission:'Free',
        events:[
          {icon:'🎭', name:'Muay Thai Show', time:'Daily · 20:00 & 21:30', badge:'Show', img:'https://picsum.photos/seed/muaythai/120/80',
            venue:'Asiatique Sky Stage', adm:'500 THB', desc:'Professional Muay Thai bouts and demonstration fights in a riverside open-air arena. Includes commentary in Thai and English.', tags:['Muay Thai','Sport','Show']},
          {icon:'🎡', name:'Ferris Wheel Rides', time:'Daily · 17:00 – 23:30', badge:'Fun', img:'https://picsum.photos/seed/ferris/120/80',
            venue:'Asiatique Riverside', adm:'250 THB', desc:'Ride the iconic 60-metre Asiatique Sky ferris wheel for panoramic views of the Chao Phraya River and Bangkok skyline at sunset and night.', tags:['Views','Family','Night']},
          {icon:'🍷', name:'Riverside Dinner', time:'Fri–Sat · 19:00', badge:'Dining', img:'https://picsum.photos/seed/riverdinner/120/80',
            venue:'Pier 8 Restaurant Row', adm:'From 800 THB', desc:'Special weekend riverside dining packages with set menus from five participating restaurants. Reserve in advance — tables along the river fill up fast.', tags:['Dining','Riverside','Weekend']},
        ]
      },
      {
        name:'Siam Paragon', sub:'Siam, Bangkok',
        lat:13.7467, lng:100.5333, tag:'Shopping',
        img:'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Siam_Paragon.jpg/1280px-Siam_Paragon.jpg',
        desc:'Bangkok\'s most iconic luxury mall housing 300+ international brands, Southeast Asia\'s largest aquarium (Sea Life), and a world-class cinema complex.',
        hours:'10:00 – 22:00', admission:'Free',
        events:[
          {icon:'🎬', name:'Film Festival Screening', time:'Thu–Sun · 14:00', badge:'Cinema', img:'https://picsum.photos/seed/filmfest/120/80',
            venue:'Paragon Cineplex, 5F', adm:'220 THB', desc:'Bangkok International Film Festival showcase featuring award-winning short films and documentaries from Southeast Asia. Q&A with directors after select screenings.', tags:['Film','Festival','Cinema']},
          {icon:'🛍️', name:'Luxury Brand Pop-up', time:'14–16 Mar · All Day', badge:'Sale', img:'https://picsum.photos/seed/luxury/120/80',
            venue:'Atrium, G Floor', desc:'Exclusive 3-day pop-up featuring limited-edition collections from 12 international luxury brands. VIP early access at 09:00 with registration.', adm:'Free entry', tags:['Luxury','Shopping','Limited']},
          {icon:'🎤', name:'K-POP Fan Meet', time:'Sat, 15 Mar · 16:00', badge:'Event', img:'https://picsum.photos/seed/kpop/120/80',
            venue:'Siam Paragon Hall', adm:'1,200 THB', desc:'Fan meeting and mini-concert with rising K-POP group. Ticket includes photocard set and entry to fan signing session after the show.', tags:['K-POP','Music','Fanmeet']},
        ]
      },
      {
        name:'Victory Monument', sub:'Bangkok',
        lat:13.7628, lng:100.5378, tag:'Landmark',
        img:'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Anusawari_Chai_Samoraphum.jpg/1280px-Anusawari_Chai_Samoraphum.jpg',
        desc:'An iconic Art Deco obelisk erected in 1941 to commemorate Thai soldiers. Now the city\'s busiest transit hub and a vibrant night street-food destination.',
        hours:'Always open', admission:'Free',
        events:[
          {icon:'🌙', name:'Night Street Food', time:'Daily · 18:00 – 00:00', badge:'Food', img:'https://picsum.photos/seed/nightfood/120/80',
            venue:'Around the Monument', adm:'Free', desc:'Bangkok\'s most iconic night street food scene. Hundreds of vendors circle the monument offering grilled meats, noodles, somtam, and freshly squeezed juices.', tags:['Food','Night','Street']},
          {icon:'🎆', name:'Historical Light Show', time:'Sat, 15 Mar · 20:00', badge:'Show', img:'https://picsum.photos/seed/lightshow/120/80',
            venue:'Victory Monument Plaza', adm:'Free', desc:'Projection mapping and light show on the monument commemorating Thailand\'s military history. Show runs 20 minutes and repeats at 21:00.', tags:['History','Light Show','Free']},
          {icon:'🚇', name:'BTS Shuttle Tour', time:'Sun, 16 Mar · 10:00', badge:'Tour', img:'https://picsum.photos/seed/btshuttle/120/80',
            venue:'BTS Victory Monument Stn', adm:'350 THB', desc:'Hop-on hop-off BTS-guided city tour starting from Victory Monument. Visit 6 iconic Bangkok landmarks with a bilingual audio guide included.', tags:['Tour','BTS','City']},
        ]
      },
    ];
    const CTR = {lat:13.7563, lng:100.5018};

    function hav(a,b){
      const R=6371,dLa=(b.lat-a.lat)*Math.PI/180,dLo=(b.lng-a.lng)*Math.PI/180;
      const x=Math.sin(dLa/2)**2+Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLo/2)**2;
      return (R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))).toFixed(1);
    }

    /* ── POPUP (standalone, positioned via map.project) ── */
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
      // map.project gives pixel of lat/lng = pin TIP (bottom of pin)
      const pt = map.project([p.lng, p.lat]);
      const pw = popInner.offsetWidth  || 220;
      const ph = popInner.offsetHeight || 130;
      const GAP = 8; // px gap between popup caret and pin tip
      popup.style.left = Math.round(pt.x - pw / 2) + 'px';
      popup.style.top  = Math.round(pt.y - ph - GAP) + 'px';
    }

    /* update popup position on every map move */
    map.on('move', () => { if (activeIdx >= 0) positionPopup(activeIdx); });

    /* ── MARKERS ── */
    function mkMarker(i) {
      const el = document.createElement('div');
      el.className = 'pin-wrap';
      // SVG only — no extra children that affect measured size
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
          anchor: 'center',   // center of element = center of SVG = lat/lng
          offset: [0, 19],    // shift down by half pin height (38/2=19) so tip is at lat/lng
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
      document.getElementById('evModalImg').src       = ev.img.replace('/120/80', '/800/400');
      document.getElementById('evModalTitle').textContent = ev.name;
      document.getElementById('evModalPlace').textContent = placeName;
      document.getElementById('evModalTime').textContent  = ev.time;
      document.getElementById('evModalBadge').textContent = ev.badge;
      document.getElementById('evModalVenue').textContent = ev.venue || placeName;
      document.getElementById('evModalAdm').textContent   = ev.adm || 'Free';
      document.getElementById('evModalDesc').textContent  = ev.desc || '—';
      document.getElementById('evModalTags').innerHTML = (ev.tags||[])
        .map(t => `<span class="ev-modal-tag">${t}</span>`).join('');
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

    /* ── RIGHT PANEL — static event records ── */
    const evItemsEl = document.getElementById('evItems');
    PLACES.forEach(p => {
      (p.events||[]).forEach(ev => {
        const el = document.createElement('div');
        el.className = 'ev-item';
        el.innerHTML = `
          <img class="ev-thumb" src="${ev.img}" alt="${ev.name}" loading="lazy"/>
          <div class="ev-info">
            <div class="ev-name">${ev.name}</div>
            <div class="ev-sub">${p.name} · ${ev.time}</div>
          </div>
          <div class="ev-badge">${ev.badge}</div>`;
        el.addEventListener('click', () => {
          document.querySelectorAll('.ev-item').forEach(e => e.classList.remove('active'));
          el.classList.add('active');
          openEvModal(ev, p.name);
        });
        evItemsEl.appendChild(el);
      });
    });

    /* ── PLACE LIST ── */
    const locItemsEl = document.getElementById('locItems');
    const infoCard   = document.getElementById('infoCard');

    PLACES.forEach((p,i) => {
      const el = document.createElement('div'); el.className='loc-item';
      el.innerHTML=`<div class="loc-dot"></div>
        <div class="loc-info"><div class="loc-name">${p.name}</div><div class="loc-sub">${p.sub}</div></div>
        <div class="loc-dist">${hav(CTR,p)}km</div>`;
      el.addEventListener('click', ()=>focusPlace(i));
      locItemsEl.appendChild(el);
    });

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

    function closePlace() {
      activeIdx = -1;
      popup.classList.remove('show');
      setMarkerActive(-1);
      document.querySelectorAll('.loc-item').forEach(el => el.classList.remove('active'));
      infoCard.classList.remove('visible');
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