// VR-ready Red Ball Shooter (PC + SteamVR)
// Reemplaza todo tu script por este

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';

// --- SCORE HUD -----------------------------------------------------
let score = 0;
let bestScore = localStorage.getItem("bestScore") || 0;

const scoreDiv = document.createElement("div");
scoreDiv.style.position = "absolute";
scoreDiv.style.top = "20px";
scoreDiv.style.left = "20px";
scoreDiv.style.color = "white";
scoreDiv.style.fontSize = "22px";
scoreDiv.style.fontFamily = "Arial";
scoreDiv.style.fontWeight = "bold";
scoreDiv.textContent = `Puntaje: 0 | Mejor: ${bestScore}`;
document.body.appendChild(scoreDiv);

// Timer HUD
let timeLeft = 45;
let timerActive = false;

const timerDiv = document.createElement("div");
timerDiv.style.position = "absolute";
timerDiv.style.top = "20px";
timerDiv.style.right = "20px";
timerDiv.style.color = "yellow";
timerDiv.style.fontSize = "28px";
timerDiv.style.fontFamily = "Arial";
timerDiv.style.fontWeight = "bold";
timerDiv.textContent = `Tiempo: ${timeLeft}`;
document.body.appendChild(timerDiv);

// --- CROSSHAIR HUD (Cruz DOM) -----------------------------------------
const crosshair = document.createElement("div");
crosshair.style.position = "absolute";
crosshair.style.top = "50%";
crosshair.style.left = "50%";
crosshair.style.transform = "translate(-50%, -50%)";
crosshair.style.width = "2px";
crosshair.style.height = "2px";
crosshair.style.zIndex = "999";
crosshair.style.pointerEvents = "none";

crosshair.innerHTML = `
    <div style="position:absolute; width:2px; height:20px; background:white; top:-20px; left:0;"></div>
    <div style="position:absolute; width:2px; height:20px; background:white; top:2px; left:0;"></div>
    <div style="position:absolute; width:20px; height:2px; background:white; top:0; left:-20px;"></div>
    <div style="position:absolute; width:20px; height:2px; background:white; top:0; left:2px;"></div>
`;
document.body.appendChild(crosshair);

// --- PANTALLA INICIAL ----------------------------------------------
let gameStarted = false;

const startScreen = document.createElement("div");
startScreen.style.position = "fixed";
startScreen.style.top = "0";
startScreen.style.left = "0";
startScreen.style.width = "100%";
startScreen.style.height = "100%";
startScreen.style.display = "flex";
startScreen.style.flexDirection = "column";
startScreen.style.alignItems = "center";
startScreen.style.justifyContent = "center";
startScreen.style.background = "rgba(0,0,0,0.85)";
startScreen.style.color = "white";
startScreen.style.fontFamily = "Arial";
startScreen.style.zIndex = "9999";
startScreen.style.textAlign = "center";

startScreen.innerHTML = `
    <div style="font-size:48px; font-weight:bold; margin-bottom:20px; color:#ff4444;">
        🔴💣   RED BALL SHOOTER   💣🔴
    </div>
    <div style="font-size:28px; font-weight:bold; margin-bottom:20px; color:#ffff00;">
        Objetivo: Acierta al mayor número de esferas en 45 segundos
        ¿Estás list@?
    </div>
    <div style="font-size:20px; opacity:0.8;">
        Presiona <strong>A</strong> en el control
    </div>
`;
document.body.appendChild(startScreen);

// allow Enter to start (non-gamepad)
window.addEventListener("keydown", (e) => {
    if (!gameStarted && e.key === "Enter") startGame();
});

// --- PANTALLA FINAL --------------------------------------------
const endScreen = document.createElement("div");
endScreen.style.position = "fixed";
endScreen.style.top = "0";
endScreen.style.left = "0";
endScreen.style.width = "100%";
endScreen.style.height = "100%";
endScreen.style.display = "none";
endScreen.style.flexDirection = "column";
endScreen.style.alignItems = "center";
endScreen.style.justifyContent = "center";
endScreen.style.background = "rgba(0,0,0,0.85)";
endScreen.style.color = "white";
endScreen.style.fontFamily = "Arial";
endScreen.style.zIndex = "9999";
endScreen.style.textAlign = "center";

endScreen.innerHTML = `
    <div style="font-size:48px; font-weight:bold; margin-bottom:20px; color:#ff4444;">
        ¡TIEMPO AGOTADO!
    </div>
    <div id="finalScoreText" style="font-size:26px; margin-bottom:25px;"></div>
    <div style="font-size:20px; opacity:0.8;">
        Presiona <strong>B</strong> en el control
    </div>
`;
document.body.appendChild(endScreen);

// --- GAMEPAD SUPPORT ----------------------------------------------
let gamepad = null;
let prevButtons = [];

// cooldown
let lastShootTime = 0;
const shootCooldown = 150;

window.addEventListener("gamepadconnected", (e) => {
    gamepad = navigator.getGamepads()[e.gamepad.index];
    console.log("Gamepad conectado:", e.gamepad.id);
});

// --- RENDERER / SCENE / CAMERA -----------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// --- VR BUTTON (FIXED ABOVE UI) -----------------------------------
const vrButton = VRButton.createButton(renderer);
document.body.appendChild(vrButton);

vrButton.style.position = "absolute";
vrButton.style.zIndex = "10000";    // 🔥 FIX: no queda debajo del startScreen
vrButton.style.bottom = "20px";
vrButton.style.right = "20px";
vrButton.style.opacity = "1";
vrButton.style.display = "block";

// Scene & player
const scene = new THREE.Scene();
const player = new THREE.Group();
scene.add(player);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 2, 5);
player.add(camera);

// --- ORBIT CONTROLS -----------------------------------------------
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableRotate = false;
controls.enablePan = false;
controls.enableZoom = false;
controls.target.set(0, 1, 0);

// --- CAMERA ROTATION (non-VR only) --------------------------------
let camRotX = 0;
let camRotY = 0;
const camSensitivity = 0.04;

function updateGamepadCamera() {
    if (!gamepad) return;
    const gp = navigator.getGamepads()[gamepad.index];
    if (!gp) return;

    const rx = gp.axes[2] ?? 0;
    const ry = gp.axes[3] ?? 0;
    const deadZone = 0.05;

    if (!renderer.xr.isPresenting) {
        if (Math.abs(rx) > deadZone) camRotY -= rx * camSensitivity;
        if (Math.abs(ry) > deadZone) {
            camRotX -= ry * camSensitivity;
            camRotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camRotX));
        }
        camera.rotation.x = camRotX;
        camera.rotation.y = camRotY;
    }
}

// --- SKYBOX --------------------------------------------------------
const cubeLoader = new THREE.CubeTextureLoader();
cubeLoader.setPath('./UV/');
const skyboxTexture = cubeLoader.load([
    'px.png','nx.png','py.png','ny.png','pz.png','nz.png'
]);
skyboxTexture.colorSpace = THREE.SRGBColorSpace;
scene.background = skyboxTexture;

// --- LUCES ----------------------------------------------------------
const ambient = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambient);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
dirLight.position.set(0, 10, 5);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
scene.add(dirLight);

const fillLight = new THREE.PointLight(0x4488ff, 1.5, 30);
fillLight.position.set(-5, 3, 5);
scene.add(fillLight);

scene.fog = new THREE.Fog(0x111111, 2, 35);

// --- PISO -----------------------------------------------------------
const piso_1 = new THREE.TextureLoader().load('assets/marco-completo-de-fondo-grunge-degradado.jpg');
piso_1.wrapS = piso_1.wrapT = THREE.RepeatWrapping;
piso_1.repeat.set(8, 8);

const PISO = new THREE.MeshPhongMaterial({ map: piso_1 });

const geometry = new THREE.BoxGeometry(40, 0.1, 80);
const cube = new THREE.Mesh(geometry, PISO);
cube.position.z = -30;
cube.receiveShadow = true;
scene.add(cube);

const cube2 = cube.clone();
cube2.position.y = 10;
scene.add(cube2);

// --- TEXTURA PARA PARED --------------------------------------------
const wallTexture = piso_1.clone();
wallTexture.needsUpdate = true;
wallTexture.wrapS = THREE.RepeatWrapping;
wallTexture.wrapT = THREE.RepeatWrapping;
wallTexture.repeat.set(2, 1);

const wallMaterial = new THREE.MeshPhongMaterial({ map: wallTexture });

function createWall(w, h, x, y, z, rotY = 0) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMaterial);
    wall.position.set(x, y, z);
    wall.rotation.y = rotY;
    wall.receiveShadow = true;
    scene.add(wall);
}

createWall(40, 10, 0, 5, -50);
createWall(80, 10, 20, 5, -30, -Math.PI / 2);
createWall(80, 10, -20, 5, -30, Math.PI / 2);
createWall(40, 10, 0, 5, 10, Math.PI);

// --- ENEMIGOS ------------------------------------------------------
let enemies = [];

function createEnemy() {
    if (!timerActive) return;
    if (Math.random() > 0.7) return;

    const size = Math.random() * 0.25 + 0.5;

    const enemy = new THREE.Mesh(
        new THREE.SphereGeometry(size, 16, 16),
        new THREE.MeshStandardMaterial({
            color: new THREE.Color(Math.random(), Math.random(), 0)
        })
    );
    enemy.castShadow = true;

    const x = (Math.random() - 0.5) * 16;
    const y = Math.random() * 3 + 0.5;
    const z = -30;

    enemy.position.set(x, y, z);
    enemy.userData.speed = Math.random() * 0.04 + 0.01;

    enemies.push(enemy);
    scene.add(enemy);
}

for (let i = 0; i < 2; i++) createEnemy();
setInterval(() => createEnemy(), 1500);

// --- BOLITAS DE DISPARO --------------------------------------------
let bullets = [];

function shootBullet(origin, direction) {
    const bullet = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 16, 16),
        new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xaa0000 })
    );
    bullet.castShadow = true;

    bullet.position.copy(origin);
    bullet.userData.direction = direction.clone().normalize();
    bullet.userData.speed = 1.5;

    bullets.push(bullet);
    scene.add(bullet);
}

function shoot() {
    if (!timerActive) return;

    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    const origin = new THREE.Vector3();
    camera.getWorldPosition(origin);

    shootBullet(origin, direction);
}

// --- TIMER ----------------------------------------------------------
setInterval(() => {
    if (!timerActive) return;

    timeLeft--;
    timerDiv.textContent = `Tiempo: ${timeLeft}`;

    if (timeLeft <= 0) {
        timerActive = false;

        if (score > bestScore) {
            bestScore = score;
            localStorage.setItem("bestScore", bestScore);
        }

        scoreDiv.textContent = `Puntaje: ${score} | Mejor: ${bestScore}`;

        const finalScoreText = document.getElementById("finalScoreText");
        finalScoreText.innerHTML = `
            Puntaje obtenido: <strong>${score}</strong><br>
            Mejor puntaje: <strong>${bestScore}</strong>
        `;

        endScreen.style.display = "flex";
    }
}, 1000);

// --- VR CROSSHAIR (3D) ---------------------------------------------
const vrCrosshair = new THREE.Mesh(
    new THREE.RingGeometry(0.02, 0.03, 32),
    new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
);
vrCrosshair.position.set(0, 0, -1);
vrCrosshair.rotation.x = Math.PI;
vrCrosshair.visible = false;
camera.add(vrCrosshair);

renderer.xr.addEventListener('sessionstart', () => {
    crosshair.style.display = 'none';
    vrCrosshair.visible = true;
});
renderer.xr.addEventListener('sessionend', () => {
    crosshair.style.display = '';
    vrCrosshair.visible = false;
});

// --- START / RESET -------------------------------------------------
function startGame() {
    if (gameStarted) return;
    gameStarted = true;
    startScreen.style.display = "none";
    timerActive = true;
    timeLeft = 45;
    score = 0;
    scoreDiv.textContent = `Puntaje: 0 | Mejor: ${bestScore}`;
}

function resetGame() {
    window.location.reload();
}

function isButtonPressed(gp, idxs) {
    if (!gp || !gp.buttons) return false;
    for (let i of idxs) {
        if (gp.buttons[i] && gp.buttons[i].pressed) return true;
    }
    return false;
}

// --- ANIMACIÓN -----------------------------------------------------
function animate() {
    controls.update();
    updateGamepadCamera();

    const gpl = navigator.getGamepads ? navigator.getGamepads() : [];

    if (gamepad) gamepad = gpl[gamepad.index] || gamepad;
    else {
        for (let gp of gpl) {
            if (gp && gp.id && gp.connected) {
                gamepad = gp;
                break;
            }
        }
    }

    if (gamepad) {
        const gp = gamepad;

        if (isButtonPressed(gp, [0]) && !gp._wasA) {
            startGame();
        }
        gp._wasA = isButtonPressed(gp, [0]);

        if (isButtonPressed(gp, [1]) && !gp._wasB) {
            if (!timerActive) resetGame();
        }
        gp._wasB = isButtonPressed(gp, [1]);

        const now = performance.now();
        const rtPressed = isButtonPressed(gp, [7, 6, 2]);
        if (rtPressed && (now - lastShootTime >= shootCooldown)) {
            shoot();
            lastShootTime = now;
        }

        prevButtons = gp.buttons.map(b => b.pressed);
    }

    if (timerActive) {
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.position.add(b.userData.direction.clone().multiplyScalar(b.userData.speed));

            if (b.position.length() > 100) {
                scene.remove(b);
                bullets.splice(i, 1);
                continue;
            }

            for (let eIndex = enemies.length - 1; eIndex >= 0; eIndex--) {
                const e = enemies[eIndex];

                if (b.position.distanceTo(e.position) < 0.8) {
                    scene.remove(e);
                    enemies.splice(eIndex, 1);

                    scene.remove(b);
                    bullets.splice(i, 1);

                    score++;
                    scoreDiv.textContent = `Puntaje: ${score} | Mejor: ${bestScore}`;

                    createEnemy();
                    break;
                }
            }
        }

        enemies.forEach(enemy => {
            enemy.position.z += enemy.userData.speed;
        });
    }

    renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

// --- REINICIO (R) --------------------------------------------------
window.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "r") resetGame();
});

// --- RESIZE --------------------------------------------------------
window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
