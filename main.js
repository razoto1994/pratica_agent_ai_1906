import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 150, 600);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);

// Road Path (S-shape with descent)
const points = [
    new THREE.Vector3(0, 80, 400),    // Início (topo)
    new THREE.Vector3(0, 70, 300),
    new THREE.Vector3(80, 50, 150),   // Curva 1 para a direita (descendo)
    new THREE.Vector3(-80, 20, -50),  // Curva 2 para a esquerda (S)
    new THREE.Vector3(0, 5, -200),
    new THREE.Vector3(0, 0, -400)     // Fim (base)
];

const curve = new THREE.CatmullRomCurve3(points);

// Road Geometry (Extruded shape for a flat road)
const roadWidth = 12;
const shape = new THREE.Shape();
shape.moveTo(-roadWidth/2, 0);
shape.lineTo(roadWidth/2, 0);

const extrudeSettings = {
    steps: 100,
    bevelEnabled: false,
    extrudePath: curve
};

const roadGeometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
const road = new THREE.Mesh(roadGeometry, roadMaterial);
road.receiveShadow = true;
scene.add(road);

// Road Stripes
const stripePoints = curve.getPoints(100);
const stripeGeometry = new THREE.BufferGeometry().setFromPoints(stripePoints);
const stripeMaterial = new THREE.LineDashedMaterial({
    color: 0xffff00,
    dashSize: 5,
    gapSize: 3,
});
const stripes = new THREE.Line(stripeGeometry, stripeMaterial);
stripes.computeLineDistances();
stripes.position.y += 0.2;
scene.add(stripes);

// Terrain
const terrainSize = 1200;
const terrainGeometry = new THREE.PlaneGeometry(terrainSize, terrainSize, 120, 120);

const pos = terrainGeometry.attributes.position;
for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let z_geo = pos.getY(i); // Plane is on XY, will rotate to XZ

    // World coordinates after rotation
    let worldX = x;
    let worldZ = -z_geo;

    // Default height: descent
    let height = (worldZ + 400) * 0.1;

    // Hills to block visibility
    // If we are near the curves, raise the terrain on the inner side
    // Curve 1 is at Z ~ 150, X ~ 80 (Right turn, inner side is X > 80)
    if (worldZ > 100 && worldZ < 250 && worldX > 40) {
        height += 40 * Math.sin((worldZ - 100) / 150 * Math.PI);
    }
    // Curve 2 is at Z ~ -50, X ~ -80 (Left turn, inner side is X < -80)
    if (worldZ > -150 && worldZ < 50 && worldX < -40) {
        height += 45 * Math.sin((worldZ + 150) / 200 * Math.PI);
    }

    // General noise
    height += Math.sin(worldX * 0.02) * Math.cos(worldZ * 0.02) * 10;

    pos.setZ(i, height);
}
terrainGeometry.computeVertexNormals();

const terrainMaterial = new THREE.MeshStandardMaterial({
    color: 0x2d4c2d,
    flatShading: true,
    roughness: 0.8
});
const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
terrain.rotation.x = -Math.PI / 2;
terrain.receiveShadow = true;
scene.add(terrain);

// Add safety hazards (Trees/Vegetation)
function addTree(x, z, y) {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.7, 4),
        new THREE.MeshStandardMaterial({ color: 0x4b2d0b })
    );
    trunk.position.y = 2;
    group.add(trunk);

    const leaves = new THREE.Mesh(
        new THREE.ConeGeometry(3, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0x0a4d0a })
    );
    leaves.position.y = 7;
    group.add(leaves);

    group.position.set(x, y, z);
    scene.add(group);
}

// Populate trees on inner curves to maximize visual interference
for (let i = 0; i < 150; i++) {
    const t = Math.random();
    const p = curve.getPoint(t);

    // Determine which side is "inner"
    // At t < 0.5 (first curve to right), inner is X > p.x
    // At t > 0.5 (second curve to left), inner is X < p.x
    let offsetSide = (t < 0.5) ? 1 : -1;
    let dist = 8 + Math.random() * 25;

    addTree(p.x + offsetSide * dist, p.z + (Math.random()-0.5)*10, p.y - 1);
}

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
sunLight.position.set(200, 300, 100);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
scene.add(sunLight);

// Driver's Perspective Setup
let driverMode = false;
let progress = 0;

camera.position.set(0, 120, 500);
camera.lookAt(0, 50, 0);

// Speed Control for driver mode
let speed = 0.001;

// UI Buttons
const uiContainer = document.createElement('div');
uiContainer.style.position = 'absolute';
uiContainer.style.top = '200px';
uiContainer.style.left = '10px';
uiContainer.style.display = 'flex';
uiContainer.style.flexDirection = 'column';
uiContainer.style.gap = '10px';
uiContainer.style.zIndex = '100';
document.body.appendChild(uiContainer);

const btn = document.createElement('button');
btn.innerText = 'Alternar Vista: Motorista / Órbita';
btn.style.padding = '10px';
uiContainer.appendChild(btn);

const speedLabel = document.createElement('div');
speedLabel.innerText = 'Velocidade:';
speedLabel.style.color = 'white';
speedLabel.style.background = 'rgba(0,0,0,0.5)';
speedLabel.style.padding = '5px';
uiContainer.appendChild(speedLabel);

const speedSlider = document.createElement('input');
speedSlider.type = 'range';
speedSlider.min = '0.0001';
speedSlider.max = '0.005';
speedSlider.step = '0.0001';
speedSlider.value = '0.001';
uiContainer.appendChild(speedSlider);

speedSlider.oninput = (e) => {
    speed = parseFloat(e.target.value);
};

btn.onclick = () => {
    driverMode = !driverMode;
    controls.enabled = !driverMode;
    if (!driverMode) {
        camera.position.set(0, 120, 500);
        camera.lookAt(0, 50, 0);
    }
};

function animate() {
    requestAnimationFrame(animate);

    if (driverMode) {
        progress += speed;
        if (progress > 1) progress = 0;

        const pos = curve.getPoint(progress);
        const lookAtPos = curve.getPoint(Math.min(progress + 0.05, 1));

        camera.position.set(pos.x, pos.y + 2, pos.z);
        camera.lookAt(lookAtPos.x, lookAtPos.y + 2, lookAtPos.z);
    } else {
        controls.update();
    }

    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
