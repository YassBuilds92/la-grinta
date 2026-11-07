import * as THREE from 'three';

// Objets 3D posés sur les coins du plateau
const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
function add(g, geo, mat, x, y, z) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}

// Prison islamique : cellule à barreaux, coupole dorée et croissant
export function buildPrison() {
  const g = new THREE.Group();
  const stone = M('#f1e9ff');
  const stone2 = M('#d9cdf0');
  const gold = M('#ffc531', { metalness: 0.6, roughness: 0.35 });
  const bars = M('#7d7398', { metalness: 0.6, roughness: 0.4 });
  const S = 0.82; // emprise
  add(g, new THREE.BoxGeometry(S + 0.06, 0.07, S + 0.06), stone2, 0, 0.035, 0);
  // piliers d'angle
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      add(g, new THREE.BoxGeometry(0.13, 0.86, 0.13), stone, sx * (S / 2 - 0.05), 0.5, sz * (S / 2 - 0.05));
      add(g, new THREE.BoxGeometry(0.17, 0.06, 0.17), stone2, sx * (S / 2 - 0.05), 0.1, sz * (S / 2 - 0.05));
    }
  // barreaux (épais pour rester nets de loin), côté extérieur seulement : l'entrée reste ouverte vers le plateau
  const barGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.8, 6);
  for (let k = 1; k <= 4; k++) {
    const o = -S / 2 + 0.05 + (k * (S - 0.1)) / 5;
    add(g, barGeo, bars, o, 0.48, S / 2 - 0.05); // face caméra
    add(g, barGeo, bars, -S / 2 + 0.05, 0.48, o); // face gauche
  }
  add(g, new THREE.BoxGeometry(S - 0.1, 0.04, 0.05), bars, 0, 0.62, S / 2 - 0.05);
  add(g, new THREE.BoxGeometry(0.05, 0.04, S - 0.1), bars, -S / 2 + 0.05, 0.62, 0);
  // entablement
  add(g, new THREE.BoxGeometry(S + 0.1, 0.11, S + 0.1), stone, 0, 0.98, 0);
  add(g, new THREE.BoxGeometry(S + 0.14, 0.04, S + 0.14), gold, 0, 1.05, 0);
  // tambour + coupole facettée
  add(g, new THREE.CylinderGeometry(0.33, 0.35, 0.12, 12), stone2, 0, 1.13, 0);
  add(g, new THREE.SphereGeometry(0.34, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), gold, 0, 1.19, 0);
  add(g, new THREE.CylinderGeometry(0.03, 0.05, 0.16, 6), gold, 0, 1.6, 0);
  // croissant qui tourne doucement
  const moonPivot = new THREE.Group();
  moonPivot.position.y = 1.78;
  g.add(moonPivot);
  const moon = add(moonPivot, new THREE.TorusGeometry(0.11, 0.035, 6, 18, Math.PI * 1.35), M('#ffd84a', { emissive: '#ffb000', emissiveIntensity: 0.35, metalness: 0.4 }), 0, 0, 0);
  moon.rotation.z = Math.PI * 0.32 + Math.PI;
  // petits minarets aux coins arrière
  for (const [x, z] of [[S / 2, -S / 2], [-S / 2, -S / 2], [S / 2, S / 2]]) {
    add(g, new THREE.CylinderGeometry(0.055, 0.06, 0.32, 8), stone, x, 1.2, z);
    add(g, new THREE.ConeGeometry(0.075, 0.14, 8), gold, x, 1.43, z);
  }
  g.userData.update = (t) => {
    moonPivot.rotation.y = t * 0.6;
    moonPivot.position.y = 1.78 + Math.sin(t * 1.6) * 0.03;
  };
  return g;
}

// Sabre courbe qui flotte au-dessus de la case Sanction
export function buildScimitar() {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  g.add(inner);
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.03);
  shape.quadraticCurveTo(0.42, -0.06, 0.66, -0.27);
  shape.quadraticCurveTo(0.56, 0.04, 0, 0.035);
  shape.closePath();
  const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.025, bevelEnabled: false, curveSegments: 10 }), M('#eef3fb', { metalness: 0.7, roughness: 0.25 }));
  blade.position.z = -0.0125;
  blade.castShadow = true;
  inner.add(blade);
  add(inner, new THREE.BoxGeometry(0.05, 0.16, 0.06), M('#ffc531', { metalness: 0.6 }), -0.02, 0, 0);
  add(inner, new THREE.BoxGeometry(0.18, 0.05, 0.05), M('#7a3b1e'), -0.13, 0, 0);
  add(inner, new THREE.SphereGeometry(0.035, 8, 6), M('#ffc531', { metalness: 0.6 }), -0.23, 0, 0);
  inner.position.x = -0.2;
  inner.rotation.z = -0.5;
  g.userData.update = (t) => {
    g.rotation.y = t * 0.8;
    g.position.y = 0.55 + Math.sin(t * 1.7) * 0.06;
  };
  return g;
}
