import * as THREE from 'three';
for (const id of ['akhi','cheikh','ronin','fauve']) {
  const m = await import(`../src/three/champs/${id}.js`);
  const c = m.create();
  const rig = c.buildMeshRig((pr, g) => [new THREE.Mesh(g, new THREE.MeshStandardMaterial())]);
  for (const mode of ['chill','walk','win']) { c.applyPose(c.ANIMS[mode](1.3), 0.016, 1.3); }
  c.copyPose(rig.joints);
  rig.root.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(rig.root);
  console.log(id, b.min.y.toFixed(2), b.max.y.toFixed(2), Object.keys(c.PAL).join(','), [...new Set(c.PARTS.flatMap(p=>p.prims.map(q=>q.m)))].join(','));
}
