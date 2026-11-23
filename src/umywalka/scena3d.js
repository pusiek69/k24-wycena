/**
 * PODGLĄD 3D UMYWALKI — scena three.js.
 *
 * ŹRÓDŁO: projekt Dawida (artefakt z 23.11.2026). To jest ta część, o którą
 * mu chodziło najbardziej („głównie mi chodzi o ten efekt 3D"), więc nie
 * wymyślam jej na nowo: przenoszę jego kod, dokładam komentarze i trzy rzeczy,
 * których w artefakcie nie było.
 *
 * CO DOŁOŻONE:
 *   1. three.js jest WCZYTYWANY LENIWIE i z naszego serwera, nie z CDN-a
 *      (Content-Security-Policy strony dopuszcza tylko własne skrypty,
 *      a biblioteka waży więcej niż cała reszta strony — ściąga się dopiero,
 *      gdy podgląd naprawdę jest potrzebny).
 *   2. Oszczędzanie na słabszych telefonach: niższa rozdzielczość renderu,
 *      mniejsza mapa cieni albo cienie wyłączone, mniejsza tekstura kamienia.
 *      Bez tego scena z dwoma zlewami potrafi zejść do kilkunastu klatek.
 *   3. Pauza, gdy podglądu nie widać (zakładka w tle, przewinięty ekran) —
 *      telefon przestaje grzać się bez powodu.
 *
 * Układ: x = długość, y = w górę, z = głębokość (przód = +z). Centymetry.
 */
import { bryly, srodkiZlewow } from './model.js';

/** Czy to sprzęt, na którym trzeba oszczędzać. */
function slabySprzet() {
  const rdzenie = navigator.hardwareConcurrency || 4;
  const pamiec = navigator.deviceMemory || 4;
  const waski = Math.min(screen.width, screen.height) < 500;
  return rdzenie <= 4 || pamiec <= 4 || waski;
}

/**
 * Uruchamia podgląd. Zwraca `null`, gdy WebGL jest niedostępny — wtedy
 * strona pokazuje komunikat zastępczy, a wycena liczy się normalnie.
 *
 * @param {object} p
 * @param {HTMLElement} p.scena      kontener (pozycjonowany)
 * @param {HTMLElement} p.etykiety   warstwa na chipy z wymiarami
 * @param {Function} p.stan          () => stan konfiguratora
 * @param {Function} p.wyglad        () => { plik, faktura } — zdjęcie wzoru
 *                                   kamienia albo parametry tekstury rysowanej
 */
export async function uruchomPodglad({ scena, etykiety, stan, wyglad }) {
  let T;
  try {
    T = await import('three');
  } catch {
    return null;
  }

  const oszczedzaj = slabySprzet();
  let R;
  try {
    R = new T.WebGLRenderer({ antialias: !oszczedzaj, alpha: true, powerPreference: 'low-power' });
  } catch {
    return null;
  }

  R.setPixelRatio(Math.min(devicePixelRatio || 1, oszczedzaj ? 1.5 : 2));
  R.outputEncoding = T.sRGBEncoding;
  R.shadowMap.enabled = !oszczedzaj;
  R.shadowMap.type = T.PCFSoftShadowMap;
  scena.prepend(R.domElement);

  const sc = new T.Scene();
  const cam = new T.PerspectiveCamera(30, 1, 1, 5000);
  sc.add(new T.HemisphereLight(0xffffff, 0x7c828a, 0.55));

  const sun = new T.DirectionalLight(0xffffff, 0.9);
  sun.position.set(-90, 220, 150);
  sun.castShadow = !oszczedzaj;
  sun.shadow.mapSize.set(oszczedzaj ? 1024 : 2048, oszczedzaj ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -220, right: 220, top: 220, bottom: -220, near: 10, far: 800 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.3;
  sc.add(sun);

  const fill = new T.DirectionalLight(0xffffff, 0.3);
  fill.position.set(170, 70, -60);
  sc.add(fill);

  const podloga = new T.Mesh(new T.PlaneGeometry(3000, 3000), new T.ShadowMaterial({ opacity: 0.17 }));
  podloga.rotation.x = -Math.PI / 2;
  podloga.position.y = -24;
  podloga.receiveShadow = true;
  sc.add(podloga);

  const grp = new T.Group();
  const dimG = new T.Group();
  sc.add(grp, dimG);

  // Linie wymiarowe w kolorze złotej żyły — ten sam akcent co na stronie.
  const lineM = new T.LineBasicMaterial({ color: 0xc9a86a, depthTest: false, transparent: true });
  const chrom = new T.MeshPhongMaterial({ color: 0xb7bbc2, specular: 0xffffff, shininess: 120 });
  const ceramika = new T.MeshStandardMaterial({ color: 0xfbfbfb, roughness: 0.25, side: T.DoubleSide });
  const ciemny = new T.MeshBasicMaterial({ color: 0x151515 });

  const texC = {};
  const matC = {};

  /** Proceduralna faktura kamienia: ziarno + żyły, rysowane na canvasie. */
  function tekstura(f) {
    const klucz = JSON.stringify(f);
    if (texC[klucz]) return texC[klucz];

    const N = oszczedzaj ? 512 : 1024;
    const c = document.createElement('canvas');
    c.width = c.height = N;
    const g = c.getContext('2d');
    let s = (f.base || '').length * 977 + 13;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);

    g.fillStyle = f.base;
    g.fillRect(0, 0, N, N);

    const ziarna = (f.dense ? 36000 : 14000) * (oszczedzaj ? 0.45 : 1);
    for (let i = 0; i < ziarna; i++) {
      g.globalAlpha = 0.2 + r() * 0.6;
      g.fillStyle = f.sp[i % f.sp.length];
      const z = r() * (f.dense ? 5 : 2.6) + 0.6;
      g.fillRect(r() * N, r() * N, z, z);
    }
    for (let v = 0; v < (f.veins || 0); v++) {
      g.globalAlpha = 0.18 + r() * 0.32;
      g.strokeStyle = f.vein;
      g.lineWidth = (f.vw || 1) * (0.6 + r() * 2);
      g.beginPath();
      let x = r() * N;
      let y = -30;
      let dx = (r() - 0.5) * 2;
      g.moveTo(x, y);
      while (y < N + 30) {
        dx += (r() - 0.5) * 0.5;
        x += dx * 9 + (r() - 0.5) * 18;
        y += 14 + r() * 16;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    g.globalAlpha = 1;

    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.MirroredRepeatWrapping;
    t.encoding = T.sRGBEncoding;
    t.anisotropy = R.capabilities.getMaxAnisotropy();
    return (texC[klucz] = t);
  }

  /**
   * PRAWDZIWY WZÓR KAMIENIA ze zdjęcia katalogowego Architype.
   *
   * Zdjęcie leży u nas (public/wzory), wczytuje się dopiero przy wyborze
   * wzoru i kafelkuje po bryle w skali 1 m — dzięki temu żyła na blacie ma
   * mniej więcej taki rozmiar jak na prawdziwej płycie. Gdy zdjęcia nie ma
   * (kilkanaście wzorów z cennika go nie ma), zostaje tekstura rysowana.
   */
  const ladowarka = new T.TextureLoader();
  function zeZdjecia(plik) {
    if (texC[plik]) return texC[plik];
    const t = ladowarka.load(
      plik,
      () => kick(),
      undefined,
      () => {
        // Nie udało się wczytać — nie zostawiamy klienta z czarną bryłą.
        delete texC[plik];
      }
    );
    t.wrapS = t.wrapT = T.MirroredRepeatWrapping;
    t.encoding = T.sRGBEncoding;
    t.anisotropy = R.capabilities.getMaxAnisotropy();
    return (texC[plik] = t);
  }

  /** Materiał kamienia: zwykły i podświetlony (do najechania na formatkę). */
  function kamien(w) {
    const klucz = w.plik || JSON.stringify(w.faktura);
    if (matC[klucz]) return matC[klucz];
    const mapa = w.plik ? zeZdjecia(w.plik) : tekstura(w.faktura);
    const a = new T.MeshStandardMaterial({ map: mapa, roughness: 0.42, metalness: 0 });
    const b = a.clone();
    // Podświetlenie formatki: rozgrzane złoto, nie pomarańcz.
    b.emissive = new T.Color(0xd9bd84);
    b.emissiveIntensity = 0.38;
    return (matC[klucz] = { a, b });
  }

  /** Rozciągnięcie faktury po ścianach bryły, żeby nie „pływała". */
  function uv(g, p, k) {
    const P = g.attributes.position;
    const U = g.attributes.uv;
    const o = (k.charCodeAt(0) * 37 + k.length * 53) % 97;
    for (let i = 0; i < U.count; i++) {
      const f = Math.floor(i / 4) >> 1;
      const x = P.getX(i) + p[0] + o;
      const y = P.getY(i) + p[1];
      const z = P.getZ(i) + p[2] + o * 0.5;
      U.setXY(i, (f === 0 ? z : x) / 100, (f === 1 ? z : y) / 100);
    }
    U.needsUpdate = true;
  }

  function bateria(S) {
    const g = new T.Group();
    const rura = (r, h, x, y, z, rx = 0) => {
      const o = new T.Mesh(new T.CylinderGeometry(r, r, h, oszczedzaj ? 14 : 28), chrom);
      o.position.set(x, y, z);
      o.rotation.x = rx;
      o.castShadow = !oszczedzaj;
      g.add(o);
    };
    rura(2.6, 0.8, 0, 0.4, 0);
    rura(1.5, 16, 0, 8.4, 0);
    rura(1.1, 12.5, 0, 15.6, 5.6, Math.PI / 2);
    rura(1.25, 1.8, 0, 14.9, 11.4);
    rura(0.55, 6, 0, 17.6, -2, -0.55);
    if (S.mode === 'top') g.scale.y = 1.45;
    return g;
  }

  /** Ceramiczna misa przy blacie pod umywalkę nablatową. */
  function misa(S) {
    const pts = [
      [0, 0], [9, 0], [15, 1.5], [19, 5], [20.5, 11], [21, 13.5],
      [20, 13.5], [19.2, 10.5], [17.6, 6], [13.6, 2.8], [8, 1.7], [0, 1.7],
    ].map((a) => new T.Vector2(a[0], a[1]));
    const o = new T.Mesh(new T.LatheGeometry(pts, oszczedzaj ? 28 : 56), ceramika);
    o.scale.set(Math.min(1, (S.L - 18) / 42), 1, Math.min(1, (S.W - 14) / 42));
    o.castShadow = !oszczedzaj;
    const g = new T.Group();
    g.add(o);
    return g;
  }

  let meshes = [];
  let labs = [];
  let ex = 0;
  let exT = 0;
  let th = 0.62;
  let ph = 0.48;
  let thT = 0.62;
  let phT = 0.48;
  let rad = 320;
  let radT = 320;
  let raf = 0;
  let cur = null;
  let hlK = null;
  let widoczna = true;

  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tgt = new T.Vector3(0, 8, 0);
  const tgtT = tgt.clone();
  const ease = (x) => x * x * (3 - 2 * x);
  const v3 = (a) => new T.Vector3(a[0], a[1], a[2]);
  const fd = (v) => (Math.round(v * 10) / 10).toLocaleString('pl-PL');

  function build(lista) {
    const S = stan();
    grp.children.slice().forEach((o) => {
      grp.remove(o);
      o.traverse((c) => c.geometry && c.geometry.dispose());
    });
    dimG.children.slice().forEach((o) => {
      dimG.remove(o);
      o.geometry.dispose();
    });

    meshes = [];
    cur = kamien(wyglad());
    const idx = {};
    lista.forEach((r) => (idx[r.k] = r.i));

    bryly(S).forEach((pt) => {
      let o;
      if (pt.obj) o = pt.obj === 'tap' ? bateria(S) : misa(S);
      else {
        const g = new T.BoxGeometry(pt.s[0], pt.s[1], pt.s[2]);
        uv(g, pt.p, pt.k);
        o = new T.Mesh(g, pt.dark ? ciemny : cur.a);
        o.castShadow = o.receiveShadow = !pt.dark && !oszczedzaj;
        if (pt.rx) o.rotation.x = pt.rx;
      }
      o.userData = {
        k: pt.k,
        st: !pt.obj && !pt.dark,
        b: v3(pt.p),
        e: v3(pt.ex || [0, 0, 0]),
        hideEx: pt.hideEx,
      };
      o.position.copy(o.userData.b);
      grp.add(o);
      meshes.push(o);
    });

    // Linie wymiarowe — pomarańczowe, jak na stole kamieniarskim.
    const { L, W, H, sL, sW } = S;
    const x0 = -L / 2;
    const x1 = L / 2;
    const zf = W / 2;
    const zb = -W / 2;
    const o = 11;
    const pts = [];
    const ln = (a, b) => pts.push(v3(a), v3(b));
    ln([x0, 0, zf + 3], [x0, 0, zf + o + 3]);
    ln([x1, 0, zf + 3], [x1, 0, zf + o + 3]);
    ln([x0, 0, zf + o], [x1, 0, zf + o]);
    ln([x1 + 3, 0, zb], [x1 + o + 3, 0, zb]);
    ln([x1 + 3, 0, zf], [x1 + o + 3, 0, zf]);
    ln([x1 + o, 0, zb], [x1 + o, 0, zf]);
    ln([x0 - 3, 0, zf], [x0 - o - 3, 0, zf]);
    ln([x0 - 3, H, zf], [x0 - o - 3, H, zf]);
    ln([x0 - o, 0, zf], [x0 - o, H, zf]);
    const ls = new T.LineSegments(new T.BufferGeometry().setFromPoints(pts), lineM);
    ls.renderOrder = 9;
    dimG.add(ls);

    // Chipy z wymiarami i numerki formatek — zwykły HTML nad canvasem.
    etykiety.innerHTML = '';
    labs = [];
    const add = (t, p, c, e) => {
      const el = document.createElement('div');
      el.className = 'lb ' + c;
      // Zaczynamy od niewidocznej: pierwszą klatkę ustawi `tick`, a bez tego
      // numerki formatek mrugają przez moment na złożonej bryle.
      el.style.opacity = 0;
      el.textContent = t;
      etykiety.appendChild(el);
      labs.push({ el, v: v3(p), e: v3(e || [0, 0, 0]), c });
    };
    add(fd(L) + ' cm', [0, 0, zf + o], 'd');
    add(fd(W) + ' cm', [x1 + o, 0, 0], 'd');
    add(fd(H) + ' cm', [x0 - o, H / 2, zf], 'd');
    if (S.mode === 'int') {
      srodkiZlewow(S).forEach((c) =>
        add(`${S.n > 1 ? '' : 'zlew '}${fd(sL)} × ${fd(sW)}`, [c, H, 0], 'd sink')
      );
    }

    const byK = {};
    bryly(S)
      .filter((p) => idx[p.k] && !p.dark)
      .forEach((p) => (byK[p.k] = byK[p.k] || []).push(p));
    for (const k in byK) {
      const g = byK[k];
      const q = lista.find((r) => r.k === k).q;
      if (g.length > q) {
        const c = [0, 1, 2].map((i) => g.reduce((s, p) => s + p.p[i], 0) / g.length);
        if (k === 'top') c[2] = (g[0].p[2] + S.W / 2) / 2;
        add(idx[k], c, 'n', g[0].ex);
      } else {
        g.forEach((p) => add(idx[k], p.p, 'n', p.ex));
      }
    }

    podswietl(hlK);
    dopasuj();
    kick();
  }

  /** Ustawienie kamery tak, żeby cała bryła (także rozłożona) była w kadrze. */
  function dopasuj() {
    const S = stan();
    const e = ease(exT);
    const { L, W, H } = S;
    const b = new T.Box3(
      v3([-L / 2 - 16, -1, -W / 2 - 3]),
      v3([L / 2 + 16, H + (S.holes ? (S.mode === 'top' ? 26 : 19) : S.mode === 'top' ? 14 : 2), W / 2 + 16])
    );
    if (e > 0) {
      meshes.forEach((o) => {
        const c = o.userData.b.clone().addScaledVector(o.userData.e, e);
        b.expandByPoint(c.clone().addScalar(4));
        b.expandByPoint(c.addScalar(-4));
      });
    }
    const s = b.getBoundingSphere(new T.Sphere());
    const vf = (cam.fov * Math.PI) / 180;
    const hf = 2 * Math.atan(Math.tan(vf / 2) * cam.aspect);
    tgtT.copy(s.center);
    /*
     * Na wąskim ekranie odsuwamy kamerę mocniej: etykiety wymiarów stoją
     * POZA bryłą i przy ciasnym kadrze wychodziły poza krawędź podglądu.
     */
    radT = (s.radius / Math.sin(Math.min(vf, hf) / 2)) * (cam.aspect < 1.1 ? 1.08 : 0.86);
  }

  function kick() {
    if (!raf && widoczna) raf = requestAnimationFrame(tick);
  }

  function tick() {
    raf = 0;
    let ruch = false;
    const k = RM ? 1 : 0.16;
    const lp = (a, b, f) => {
      const d = b - a;
      if (Math.abs(d) < 1e-3) return b;
      ruch = true;
      return a + d * f;
    };

    th = lp(th, thT, k);
    ph = lp(ph, phT, k);
    rad = lp(rad, radT, k);
    tgt.set(lp(tgt.x, tgtT.x, k), lp(tgt.y, tgtT.y, k), lp(tgt.z, tgtT.z, k));
    ex = lp(ex, exT, RM ? 1 : 0.09);

    const e = ease(ex);
    meshes.forEach((o) => {
      o.position.copy(o.userData.b).addScaledVector(o.userData.e, e);
      if (o.userData.hideEx) o.visible = e < 0.05;
    });
    dimG.visible = e < 0.02;

    const c = Math.cos(ph);
    cam.position.set(tgt.x + rad * Math.sin(th) * c, tgt.y + rad * Math.sin(ph), tgt.z + rad * Math.cos(th) * c);
    cam.lookAt(tgt);
    R.render(sc, cam);

    const w = scena.clientWidth;
    const h = scena.clientHeight;
    const v = new T.Vector3();
    labs.forEach((l) => {
      v.copy(l.v).addScaledVector(l.e, e).project(cam);
      const widac = (l.c === 'n' ? e > 0.6 : e < 0.02) && v.z < 1;
      l.el.style.opacity = widac ? 1 : 0;
      l.el.style.transform =
        `translate(${(((v.x + 1) / 2) * w).toFixed(1)}px,${(((1 - v.y) / 2) * h).toFixed(1)}px) translate(-50%,-50%)`;
    });

    if (ruch) kick();
  }

  function podswietl(k) {
    hlK = k;
    meshes.forEach((o) => {
      if (o.userData.st) o.material = o.userData.k === k ? cur.b : cur.a;
    });
    kick();
  }

  const WIDOKI = { iso: [0.62, 0.48], front: [0, 0.08], top: [0, 1.5] };
  function widok(n) {
    const [a, b] = WIDOKI[n] || WIDOKI.iso;
    thT = a + 2 * Math.PI * Math.round((th - a) / (2 * Math.PI));
    phT = b;
    kick();
  }

  function rozloz(wlaczone) {
    exT = wlaczone ? 1 : 0;
    dopasuj();
    kick();
  }

  // Obracanie przeciągnięciem — poziomo bez ograniczeń, pionowo do 87°,
  // żeby nie dało się „zgubić" bryły pod podłogą.
  let drag = null;
  const cv = R.domElement;
  cv.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, t: thT, p: phT };
    try {
      cv.setPointerCapture(e.pointerId);
    } catch {
      /* starsze przeglądarki */
    }
    cv.style.cursor = 'grabbing';
  });
  cv.addEventListener('pointermove', (e) => {
    if (!drag) return;
    thT = th = drag.t - (e.clientX - drag.x) * 0.008;
    phT = ph = Math.min(1.52, Math.max(0.02, drag.p + (e.clientY - drag.y) * 0.006));
    document.querySelectorAll('#views button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
    kick();
  });
  const koniec = () => {
    drag = null;
    cv.style.cursor = '';
  };
  cv.addEventListener('pointerup', koniec);
  cv.addEventListener('pointercancel', koniec);

  const ro = new ResizeObserver(() => {
    const w = scena.clientWidth;
    const h = scena.clientHeight;
    if (!w || !h) return;
    R.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
    dopasuj();
    rad = radT;
    tgt.copy(tgtT);
    kick();
  });
  ro.observe(scena);

  // Nie renderujemy, gdy podglądu nie widać — telefon niepotrzebnie grzeje.
  try {
    new IntersectionObserver(
      (wpisy) =>
        wpisy.forEach((x) => {
          widoczna = x.isIntersecting;
          if (widoczna) kick();
        }),
      { threshold: 0.01 }
    ).observe(scena);
  } catch {
    /* brak obserwatora — renderujemy zawsze */
  }
  document.addEventListener('visibilitychange', () => {
    widoczna = !document.hidden;
    if (widoczna) kick();
  });

  /**
   * ZRZUT DO WIZUALIZACJI — jednorazowy render w wyższej rozdzielczości.
   *
   * Bryła złożona, kąt katalogowy, bez linii wymiarowych (te dorysujemy
   * na gotowym obrazku, w rozdzielczości obrazka). Renderujemy i czytamy
   * piksele w jednym kroku, więc nie trzeba trzymać bufora rysowania
   * przez całą sesję — przy podglądzie na telefonie to realna oszczędność.
   *
   * Po wszystkim scena wraca dokładnie do stanu, w jakim była.
   */
  function zrzut({ szer = 1400, wys = 1000 } = {}) {
    const zapasExT = exT;
    const zapasEx = ex;
    const zapasTh = th;
    const zapasPh = ph;
    const zapasRad = rad;
    const zapasTgt = tgt.clone();
    const zapasPr = R.getPixelRatio();
    const rozmiar = new T.Vector2();
    R.getSize(rozmiar);

    try {
      ex = exT = 0;
      meshes.forEach((o) => {
        o.position.copy(o.userData.b);
        if (o.userData.hideEx) o.visible = true;
      });
      dimG.visible = false;

      th = thT = 0.72;
      ph = phT = 0.42;
      R.setPixelRatio(1);
      R.setSize(szer, wys, false);
      cam.aspect = szer / wys;
      cam.updateProjectionMatrix();
      dopasuj();
      // Ciaśniejszy kadr niż w podglądzie: na obrazku bryła ma wypełniać
      // miejsce, a nie pływać w pustce.
      rad = radT * 0.78;
      tgt.copy(tgtT);

      const c = Math.cos(ph);
      cam.position.set(tgt.x + rad * Math.sin(th) * c, tgt.y + rad * Math.sin(ph), tgt.z + rad * Math.cos(th) * c);
      cam.lookAt(tgt);
      R.render(sc, cam);
      return R.domElement.toDataURL('image/png');
    } catch {
      return null;
    } finally {
      exT = zapasExT;
      ex = zapasEx;
      th = thT = zapasTh;
      ph = phT = zapasPh;
      rad = radT = zapasRad;
      tgt.copy(zapasTgt);
      tgtT.copy(zapasTgt);
      R.setPixelRatio(zapasPr);
      R.setSize(rozmiar.x, rozmiar.y, false);
      cam.aspect = rozmiar.x / Math.max(1, rozmiar.y);
      cam.updateProjectionMatrix();
      dimG.visible = true;
      dopasuj();
      kick();
    }
  }

  return { build, podswietl, widok, rozloz, zrzut };
}
