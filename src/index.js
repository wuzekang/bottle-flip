import './index.css';
import * as THREE from 'three';
import * as OIMO from 'oimo';
import TWEEN from '@tweenjs/tween.js';


const world = new OIMO.World({
  timestep: 1/60, 
  broadphase: 2, // 1 brute force, 2 sweep and prune, 3 volume tree
  worldscale: 1, // scale full world 
  random: false,  // randomize sample
  info: false,   // calculate statistic or not
  gravity: [0,-9.8,0] 
})

const box = world.add({
  type:'box', // type of shape : sphere, box, cylinder 
  size:[1,1,1], // size of shape
  pos:[0,1,0], // start position in degree
  rot:[0,0,90], // start rotation in degree
  move:true,
});

//ground
world.add({
  size:[50, 10, 50],
  pos:[0,-5,0],
  density:1 
})

let updates = [];




const body = window.document.body,
      SCREEN_WIDTH = body.offsetWidth,
      SCREEN_HEIGHT = body.offsetHeight,
      FRUSTUM_SCALE = 0.009,
      FRUSTUM_WIDTH = SCREEN_WIDTH * FRUSTUM_SCALE,
      FRUSTUM_HEIGHT = SCREEN_HEIGHT * FRUSTUM_SCALE;

const renderer = new THREE.WebGLRenderer({antialias: true});
renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
renderer.shadowMap.enabled = true;

body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.receiveShadow = true;
scene.add(new THREE.GridHelper(1000, 500));
scene.add(new THREE.AxisHelper(1000));


scene.add(new THREE.AmbientLight(0xffffff, 0.8));

const light = new THREE.DirectionalLight(0xffffff, 0.28);
light.position.set(2, 15, 10);
light.castShadow = true;
scene.add(light);

const camera = new THREE.OrthographicCamera(FRUSTUM_WIDTH / -2, FRUSTUM_WIDTH / 2, FRUSTUM_HEIGHT / 2, FRUSTUM_HEIGHT / -2, -40, 1000);
camera.position.set(-5,6,6);
camera.castShadow = true;
camera.receiveShadow = true;
camera.lookAt(new THREE.Vector3(0,0,0))


let block = nextBlock();
let next = nextBlock(block);
scene.add(block);
scene.add(next);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200, 200, 200), new THREE.ShadowMaterial({transparent: true, opacity: 0.3, color: 0x000000}));
ground.rotation.set(Math.PI / -2, 0, 0);
ground.receiveShadow = true;
ground.castShadow = true;
scene.add(ground);


const background = new THREE.Mesh(new THREE.IcosahedronGeometry(40, 4), new THREE.MeshLambertMaterial({color: 0xeeeeee, side: THREE.BackSide}));
scene.add(background);


var loader = new THREE.ObjectLoader();

var object = loader.parse(require('./models/bottle.json'));


const player = new THREE.Group();
player.position.y = 1;
player.add(object);
scene.add(player);

var props = {cubeScaleY: 1, playerScaleY: 1, playerScaleXZ: 1};

const _update = ({cubeScaleY, playerScaleY, playerScaleXZ}) => {
  block.scale.setY(cubeScaleY);
  player.position.y = cubeScaleY;
  player.scale.set(playerScaleXZ, playerScaleY, playerScaleXZ);
}

const press = new TWEEN.Tween(props)
    .to({cubeScaleY : 0.5, playerScaleY: 0.65, playerScaleXZ: 1.5}, 2000)
    .easing(TWEEN.Easing.Quadratic.Out)
    .onUpdate(_update);

const bounce = () => {
  return new TWEEN.Tween(props).to({cubeScaleY: 1, playerScaleY: 1, playerScaleXZ: 1}, 500)
    .easing(TWEEN.Easing.Bounce.Out).onUpdate(_update);
}


function nextBlock(prev = null) {
  let block = createBlock();
  if (prev) {
    const {x, z} = prev.position;
    block.position.set(x + Math.random() * 1.4 + 1.4, 0, z);
  }
  const {x, z} = block.position;
  world.add({
    size: [1, 1, 1],
    pos: [x, 0.5, z]
  })
  blockDown(block);
  return block;
}

function blockDown(block) {
  block.position.y = 0.5;
  return new TWEEN.Tween(block.position).to({y: 0}, 500).easing(TWEEN.Easing.Quadratic.Out).start();
}

function createBlock() {
  const cube = new THREE.Mesh(new THREE.CubeGeometry(1,1,1), new THREE.MeshLambertMaterial({color: 0x00ffff}));
  cube.position.y = 0.5;
  cube.castShadow = true;
  cube.receiveShadow = true;
  const block = new THREE.Group();
  block.add(cube);
  return block;
}



function animate(time) {
  requestAnimationFrame(animate);
  TWEEN.update(time);
  world.step();
  updates.forEach(fn => (fn()));
  render();
}

function render() {
  renderer.render(scene, camera);
}

render();
requestAnimationFrame(animate);


function onTouchStart(e) {
  press.start();
}

function onTouchEnd(e) {
  press.stop();
  console.log(e);
  bounce().start();

  const distance = 2,
        height = 2,
        duration = 500;
  
  new TWEEN.Tween(player.position).to({x: distance}, duration).start().onComplete(() => {
    const {x,z} = player.position;
    const _player = world.add({
      type: 'cylinder',
      size: [0.3, 0.64, 0.3],
      pos: [x, 1 + 0.64 / 2, z],
      move: true
    })
    updates.push(() => {
      player.position.copy(new THREE.Vector3().copy(_player.getPosition()).add(new THREE.Vector3(0, -0.64 / 2, 0)));
      player.quaternion.copy(_player.getQuaternion());
    })
  });
  const up = new TWEEN.Tween(player.position).to({y: 1 + height}, duration / 2).easing(TWEEN.Easing.Quadratic.Out);
  const down = new TWEEN.Tween(player.position).to({y: 1}, duration / 2).easing(TWEEN.Easing.Quadratic.In);
  new TWEEN.Tween(player.rotation).to({z: -2 * Math.PI}, duration).start();
  up.chain(down).start();
}

document.addEventListener("touchstart", onTouchStart);

document.addEventListener("touchend", onTouchEnd);




