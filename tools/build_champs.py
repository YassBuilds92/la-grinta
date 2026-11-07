"""Génère src/three/champs/<id>.js à partir des pages d'aperçu validées des persos
(styles-perso/<nom>-pixel.html). Chaque module exporte create() qui renvoie un perso
indépendant : squelette, anims (chill / walk / win) et IK, sans la page autour.
Usage : python3 tools/build_champs.py /mnt/project-files/la-grinta/styles-perso
"""
import sys, os, re
SRC = sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/la-grinta/styles-perso'
OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'three', 'champs')
CHAMPS = {'akhi': 'akhi', 'cheikh': 'cheikh', 'ronin': 'ronin', 'fauve': 'lion'}

for cid, f in CHAMPS.items():
    L = open(os.path.join(SRC, f + '-pixel.html'), encoding='utf-8').read().split('\n')
    find = lambda pat, start=0: next(i for i in range(start, len(L)) if re.search(pat, L[i]))
    a = find(r'^\s+1\. LE PERSO') + 2          # après le bandeau « 1. LE PERSO »
    b = find(r'^\s+3\. VUE PARTAG') - 1        # avant le bandeau « 3. VUE »
    c = find(r'^const BG = ')
    d = find(r'^function floorTexture')
    body = '\n'.join(L[a:b] + L[c:d])
    body = re.sub(r'^const BG = .*$', '', body, flags=re.M)
    js = f"""// Généré par tools/build_champs.py depuis styles-perso/{f}-pixel.html : ne pas modifier à la main.
import * as THREE from 'three';
import {{ RoundedBoxGeometry }} from 'three/addons/geometries/RoundedBoxGeometry.js';

export function create() {{
{body}
  return {{ PAL, PARTS, M, ANIMS, blendPose, applyPose, buildMeshRig, copyPose, anim }};
}}
"""
    open(os.path.join(OUT, cid + '.js'), 'w', encoding='utf-8').write(js)
    print(cid, len(js))
