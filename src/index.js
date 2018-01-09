import './index.css';
import * as THREE from 'three';
import * as CANNON from 'cannon';
import TWEEN from '@tweenjs/tween.js';
import Rx from 'rxjs/Rx';
import { Vector3 } from 'three';

const body = window.document.body,
      SCREEN_WIDTH = body.offsetWidth,
      SCREEN_HEIGHT = body.offsetHeight,
      FRUSTUM_SCALE = 0.009,
      FRUSTUM_WIDTH = SCREEN_WIDTH * FRUSTUM_SCALE,
      FRUSTUM_HEIGHT = SCREEN_HEIGHT * FRUSTUM_SCALE;

const FLIP_DISTANCE_UNIT = 2,
      FLIP_HEIGHT = 1.5,
      FLIP_DURATION = 500;

const BOTTLE_PRESSED_H = 1.2,
      BOTTLE_PRESSED_V = 0.45,
      BLOCK_PRESSED_H = 0.5;

const PRESS_DURATION = 3000,
      BOUNCE_DURATION = 500;


class Block {
  mesh = new THREE.Group();
  body = new CANNON.Body({
    mass: 0
  });

  constructor() {
    const cube = new THREE.Mesh(new THREE.CubeGeometry(1,1,1), new THREE.MeshLambertMaterial({color: 0x00ffff}));
    cube.position.z = 0.5;
    cube.castShadow = true;
    cube.receiveShadow = true;
    this.mesh.add(cube);
    this.body.addShape(new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5)), new CANNON.Vec3(0, 0, 0.5));
    // this.body.position.set(0, 0, 0);
  }

  update() {
      
  }

  press() {   
    this.mesh.scale.z = 1;
    return [
        new TWEEN.Tween(this.mesh.scale).to({z: BLOCK_PRESSED_H}, PRESS_DURATION).easing(TWEEN.Easing.Quadratic.Out)
    ]
  }

  bounce() {
    return [
      new TWEEN.Tween(this.mesh.scale).to({z: 1}, BOUNCE_DURATION).easing(TWEEN.Easing.Bounce.Out)
    ];
  }

  down() {
    this.mesh.position.y = 0.5;
    return new TWEEN.Tween(this.mesh.position).to({y: 0}, 500).easing(TWEEN.Easing.Quadratic.Out);
  }
}

class Bottle {
  connected = false;

  boundingBox = new THREE.Box3();
  mesh = new THREE.Group();
  body = new CANNON.Body({
    mass: 5,
  });

  constructor()  {
    this.mesh.add(new THREE.ObjectLoader().parse(require('./models/bottle.json')));
    this.mesh.position.z = 1;

    this.computeBoundingBox();
    const size = this.boundingBox.getSize();
    console.log(size);
    this.body.addShape(new CANNON.Cylinder(size.x / 4, size.x / 4, size.z, 10), new CANNON.Vec3(0, 0, size.z / 2));
    this.body.position.set(0, 0, 1);
  }

  update() {
    if (this.connected) {
      this.mesh.position.copy(this.body.position);
      this.mesh.quaternion.copy(this.body.quaternion);
    }
  }

  computeBoundingBox() {
    const boundingBox = object => {
      if (object instanceof THREE.Mesh) {
        const { geometry } = object;
        if (!geometry.boundingBox) geometry.computeBoundingBox();
        return geometry.boundingBox;
      }
      return new THREE.Box3();
    }

    const compute = object => {
      const box = boundingBox(object);
      object.children.forEach(o => {
        box.union(compute(o));
      })
      box.min.multiply(object.scale).applyEuler(object.rotation);
      box.max.multiply(object.scale).applyEuler(object.rotation);
      return box;
    }

    this.boundingBox = compute(this.mesh);
    console.log(this.boundingBox);
    return this.boundingBox;
  }

  flip(displacement) {
    const {x, y} = this.mesh.position.clone().add(displacement),
    move = new TWEEN.Tween(this.mesh.position).to({x, y}, FLIP_DURATION),
    rotation = new Vector3(1, 1, 0).sub(displacement.normalize()).multiply(new THREE.Vector3(-1, 1, 0)).multiplyScalar(Math.PI * 2),
    rotate = new TWEEN.Tween(this.mesh.rotation).to(rotation, FLIP_DURATION),
    up = new TWEEN.Tween(this.mesh.position).to({z: 1 + FLIP_HEIGHT}, FLIP_DURATION / 2).easing(TWEEN.Easing.Quadratic.Out),
    down = new TWEEN.Tween(this.mesh.position).to({z: 1}, FLIP_DURATION / 2).easing(TWEEN.Easing.Quadratic.In);
    up.chain(down);
    return [
      move, up, rotate
    ]
  }

  fall() {
    this.body.position.copy(this.mesh.position);
    this.body.quaternion.copy(this.mesh.quaternion);
    this.connected = true;
  }

  press() {
    this.mesh.scale.set(1, 1, 1);
    this.mesh.position.z = 1;
    return [
        new TWEEN.Tween(this.mesh.scale).to({x: BOTTLE_PRESSED_H, y: BOTTLE_PRESSED_H, z: BOTTLE_PRESSED_V}, PRESS_DURATION).easing(TWEEN.Easing.Quadratic.Out),
        new TWEEN.Tween(this.mesh.position).to({z: BLOCK_PRESSED_H}, PRESS_DURATION).easing(TWEEN.Easing.Quadratic.Out),
    ];
  }

  bounce() {
    return [
      new TWEEN.Tween(this.mesh.scale).to({x: 1, y: 1, z: 1}, BOUNCE_DURATION).easing(TWEEN.Easing.Bounce.Out),
    ]
  }



}

class Game {
  time = 0;

  pause = false;

  updates = [];

  world = new CANNON.World()

  renderer = new THREE.WebGLRenderer({antialias: true})

  scene = new THREE.Scene();

  camera = new THREE.OrthographicCamera(FRUSTUM_WIDTH / -2, FRUSTUM_WIDTH / 2, FRUSTUM_HEIGHT / 2, FRUSTUM_HEIGHT / -2, -40, 1000);

  bottle = new Bottle();

  blocks = [];

  _objects = [];

  down$ = Rx.Observable.fromEvent(document, 'touchstart');
  up$ = Rx.Observable.fromEvent(document, 'touchend');

  constructor() {
    //renderer
    this.renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
    this.renderer.shadowMap.enabled = true;
    body.appendChild(this.renderer.domElement);

    //scene
    this.scene.receiveShadow = true;

    //helper
    
    const gridHelper = new THREE.GridHelper(1000, 500);
    gridHelper.rotateX(Math.PI/-2)
    this.scene.add(gridHelper);
    this.scene.add(new THREE.AxisHelper(1000));
    

    //lights
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));

    const light = new THREE.DirectionalLight(0xffffff, 0.28);
    light.position.set(2, -10, 15);
    light.castShadow = true;
    this.scene.add(light);

    this.camera.position.set(-5, -6, 6);
    this.camera.castShadow = true;
    this.camera.receiveShadow = true;
    this.camera.up.set(0, 0, 1);
    this.camera.lookAt(new THREE.Vector3(0,0,0))

    //graphics ground
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200, 200, 200), new THREE.ShadowMaterial({transparent: true, opacity: 0.3, color: 0x000000}));
    ground.receiveShadow = true;
    ground.castShadow = true;
    this.scene.add(ground);

    //background
    const background = new THREE.Mesh(new THREE.IcosahedronGeometry(40, 4), new THREE.MeshLambertMaterial({color: 0xeeeeee, side: THREE.BackSide}));
    this.scene.add(background);

   
    this.scene.add(this.bottle.mesh);
    this.world.gravity.set(0, 0, -9.8);

    const _ground = new CANNON.Body({
      mass: 0,
    });

    _ground.addShape(new CANNON.Plane(), new CANNON.Vec3(0, 0, 0))
    this.world.addBody(_ground);

    this.createBlock();
    this.createBlock();

    this.add(this.bottle);
    this.moveCamera();



    this.down$
    .map(() => {
      return {
        time: this.time,
        tweens: [
          ...this.currentBlock.press(),
          ...this.bottle.press(),
        ].map(tween => (tween.start()))
      }
    })
    .debounce(() => this.up$)
    .map(({time, tweens}) => {
      tweens.forEach(tween => {
        tween.stop();
      })

      const interval = Math.min(5000, this.time - time);
      [
        ...this.currentBlock.bounce(),
        ...this.bottle.bounce(),
      ].map( tween => ( tween.start() ) );

      const direction = this.nextBlock.mesh.position.clone().sub(this.bottle.mesh.position.sub(new THREE.Vector3(0, 0, 1))).normalize();
      
      const completes = this.bottle.flip(direction.multiplyScalar(interval / 1000 * 4))
        .map( tween => ( tween.start() ) )
        .map(tween => {
          return Rx.Observable.bindCallback(tween.onComplete.bind(tween))()
        });

      return Rx.Observable.merge(...completes).last().do(() => {
        const position = this.bottle.mesh.position.clone();
        position.z = 0;
        const offset = position.sub(this.nextBlock.mesh.position).length();
        if (offset > 0.6 ) {
          console.log(this.bottle.boundingBox.getSize().x);
          console.log(offset);
          this.bottle.fall();
        } else {
          this.bottle.mesh.rotation.set(0, 0, 0);
          this.createBlock();
          this.moveCamera();
        }
      }).subscribe();
    })
    .subscribe();
    
  }



  createBlock() {
    let block = new Block();
    if (this.blocks.length) {
        const direction = Math.random() > 0.5 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
        const last = this.blocks[this.blocks.length - 1];
        const position = last.mesh.position.clone().add(direction.multiplyScalar(Math.random() * 1.2 + 1.2));
        block.body.position.copy(position);
        block.mesh.position.copy(position);
    } else {
        block.body.position.set(0, 0, 0);
        block.mesh.position.set(0, 0, 0);
    }
    this.blocks.push(block);
    this.add(block);
    return block;
  }

  get currentBlock() {
      return this.blocks[this.blocks.length - 2];
  }

  get nextBlock() {
      return this.blocks[this.blocks.length - 1];
  }

  moveCamera() {
    const position = this.nextBlock.mesh.position.clone().add(this.currentBlock.mesh.position).divideScalar(2);
    return new TWEEN.Tween(this.camera.position).to(position, 500).easing(TWEEN.Easing.Quadratic.In).start();
  }

  add(object) {
    this.world.addBody(object.body);
    this.scene.add(object.mesh);
    this._objects.push(object);
  }

  start() {
    this.pause = false;
    this.render();
    requestAnimationFrame(this.update);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  update = (time) => {
    if (this.pause) return;
    this.time = time;
    requestAnimationFrame(this.update);
    TWEEN.update();
    this.world.step(1/60);
    this._objects.forEach(o => {
        o.update();
    })
    this.render();
  }

}

new Game().start();