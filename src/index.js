import './index.css';

import * as THREE from 'three';
import * as CANNON from 'cannon';
import TWEEN from '@tweenjs/tween.js';
import Rx from 'rxjs/Rx';


const body = window.document.body,
      BODY_WIDTH = body.offsetWidth,
      BODY_HEIGHT = body.offsetHeight,
      ASPECT = BODY_WIDTH / BODY_HEIGHT,
      SCREEN_HEIGHT = Math.min(768, BODY_HEIGHT),
      SCREEN_WIDTH = SCREEN_HEIGHT * ASPECT,
      FRUSTUM_HEIGHT = 6,
      FRUSTUM_WIDTH = FRUSTUM_HEIGHT * ASPECT,
      FRUSTUM_SCALE = FRUSTUM_HEIGHT / SCREEN_HEIGHT;

      console.log(FRUSTUM_HEIGHT);

const FLIP_DISTANCE_UNIT = 4,
      FLIP_HEIGHT = 1.5,
      FLIP_DURATION = 500;

const BOTTLE_PRESSED_H = 1.2,
      BOTTLE_PRESSED_V = 0.45,
      BLOCK_PRESSED_H = 0.5,
      BLOCK_HEIGHT = 1;

const PRESS_DURATION = 3000,
      BOUNCE_DURATION = 500;

const font = new THREE.FontLoader().parse(require('./assets/font.json'))

const objectLoader = new THREE.ObjectLoader();

const cubes = [
  objectLoader.parse(require('./models/safe.json')),
  objectLoader.parse(require('./models/microwave_oven.json')),
  objectLoader.parse(require('./models/desk.json')),
  objectLoader.parse(require('./models/magic.json')),
  objectLoader.parse(require('./models/logo.json')),
  objectLoader.parse(require('./models/steve.json')),
];

class Text {
  mesh = new THREE.Group();
  material = null;

  static glyphs = null;

  fontSize = 0.4;
  scale = this.fontSize / font.data.resolution;
  lineHeight = ( font.data.boundingBox.yMax - font.data.boundingBox.yMin + font.data.underlineThickness ) * this.scale;
  
  _text = '';


  constructor(text = '', material = new THREE.MeshBasicMaterial({color: 0xffffff})){
    if (Text.glyphs === null) {
      Text.glyphs = {};
      '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ '.split('').forEach(key => {
        Text.glyphs[key] = {
          geometry: new THREE.TextGeometry(key, {
            font: font,
            size: this.fontSize,
            height: 0.1,
          }),
          width: font.data.glyphs[key].ha * this.scale
        }
      })
    }
    this.material = material;
    this._text = text.toString();
    this.redraw();
  }

  get text(){
    return this._text;
  }

  set text(_text) {
    this._text = _text.toString();
    this.redraw();
  }

  redraw() {
    this.mesh.children.length = 0;
    let offset = 0;
    this._text.toString().split('').map((key, index) => {
      const glyph = new THREE.Mesh(Text.glyphs[key].geometry, this.material);
      glyph.position.set(offset, 0, 0);
      offset += Text.glyphs[key].width;
      return glyph;
    }).forEach(char => {
      char.position.x -= offset/2;
      this.mesh.add(char);
    })
  }
}


class ShadowText {
  mesh = new THREE.Group();
  fill = new Text();
  shadow = new Text('', new THREE.MeshBasicMaterial({transparent: true, opacity: 0.3, color: 0x000000}));
  lineHeight = this.fill.lineHeight;
  _text = '';

  constructor(text = '') {
    this.text = text;
    this.shadow.mesh.position.set(0, -0.02, -0.1);
    this.mesh.add(this.fill.mesh, this.shadow.mesh);
  }

  get text() {
    return this._text;
  }

  set text(_text) {
    this._text = _text;
    this.fill.text = _text;
    this.shadow.text = _text;
    this.onUpdate();
  }

  onUpdate() {

  }
}

class ScoreText extends ShadowText {
  onUpdate() {
    this.mesh.position.set(FRUSTUM_WIDTH/2, FRUSTUM_HEIGHT - this.lineHeight/2 - 40 * FRUSTUM_SCALE, 0);
  }
}

class CenterText extends ShadowText {
  constructor(text) {
    super(text);
    this.mesh.visible = false;
    this.mesh.scale.set(0.8, 0.65, 1);
  }

  onUpdate() {
    this.mesh.position.set(FRUSTUM_WIDTH/2, FRUSTUM_HEIGHT/2, 0);
  }
}

class Canvas {
  canvas = document.createElement('canvas');
  ctx = this.canvas.getContext('2d', {alpha: true});
  texture = new THREE.CanvasTexture(this.canvas, null, null, null, THREE.LinearFilter, THREE.LinearFilter, THREE.RGBAFormat);
  geometry = new THREE.PlaneGeometry(FRUSTUM_WIDTH, FRUSTUM_HEIGHT);
  material = new THREE.MeshBasicMaterial({map: this.texture});
  mesh = new THREE.Mesh(this.geometry, this.material);

  _score = 0;

  width = SCREEN_WIDTH * window.devicePixelRatio;
  height =  SCREEN_HEIGHT * window.devicePixelRatio;

  constructor() {
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.mesh.position.set(FRUSTUM_WIDTH/2, FRUSTUM_HEIGHT/2, 0);
    this.update();
  }

  get score() {
    return this._score;
  }

  set score(x) {
    this._score = x;
  }

  update() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    
    // ctx.strokeStyle = '#ffffff';

    ctx.font = '96px serif';
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.fillStyle = 'white';
    ctx.fillText('GAME OVER', 100, 100);
    ctx.fillRect(100, 100, 12, 12);
    this.texture.needsUpdate = true;
  }
}

class Waves {
  mesh = new THREE.Group();
  rings = [];
  count = 5;
  duration = 2000;
  interval = this.duration / 10;

  constructor() {
    for(let i = 0; i < this.count; ++i) {
      let ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.4, 50, 50), new THREE.MeshBasicMaterial({transparent: true, opacity: 1, color: 0xffffff}) );
      ring.visible = false;
      ring.position.z = 0.01;
      this.rings.push(ring);
      this.mesh.add(ring);
    }
  }

  wave(count) {
    this.rings.forEach(ring => {
      ring.visible = false;
    });

    count = Math.min(this.count, count);
    for(let i = 0; i < count; ++i) {
      let ring = this.rings[i];
      

      ring.scale.set(1, 1, 1);
      new TWEEN.Tween(ring.scale).delay(this.interval * i).to({x: 4, y: 4}, this.duration)
      .easing(TWEEN.Easing.Quadratic.Out)
      .onStart(() => {
        ring.visible = true;
      })
      .start();

      ring.material.opacity = 0.8;
      new TWEEN.Tween(ring.material).delay(this.interval * i).to({opacity: 0}, this.duration)
      .easing(TWEEN.Easing.Quadratic.Out)
      .start();
    }
  }
}

class SputteringParticles {
  mesh = new THREE.Group();
  texture = new THREE.CanvasTexture( this.generateSprite() );
  material = new THREE.SpriteMaterial( {
    map: this.texture,
    color: 0xffffff,
  } );

  count = 15;
  duration = 500;

  constructor() {
    for(let i = 0; i < this.count; ++i) {
      const particle = new THREE.Sprite(this.material);
      particle.visible = false;
      this.mesh.add(particle);
    }
  }

  generateSprite() {
    var canvas = document.createElement( 'canvas' );
    canvas.width = 16;
    canvas.height = 16;
    var context = canvas.getContext( '2d' );
    var gradient = context.createRadialGradient( canvas.width / 2, canvas.height / 2, 0, canvas.width / 2, canvas.height / 2, canvas.width / 2 );
    gradient.addColorStop( 0, 'rgba(255,255,255,1)' );
    gradient.addColorStop( 1, 'rgba(255,255,255,1)' );
    context.fillStyle = gradient;
    context.fillRect( 0, 0, canvas.width, canvas.height );
    return canvas;
  }

  emit() {
    this.mesh.visible = true;
    const particles = this.mesh.children;
    particles.forEach((particle, i) => {
      particle.visible = true;

      const direction = new THREE.Vector3(Math.cos(Math.random() * 2 * Math.PI), Math.sin(Math.random() * 2 * Math.PI), 0);
      const start = direction.clone().multiplyScalar(0.15);
      const end = direction.clone().multiplyScalar(0.25);
      const height = 0.3;

      particle.scale.set(0.02, 0.02, 0.02);
      particle.position.copy(start);
      const up = new TWEEN.Tween(particle.position).to({z: height}, this.duration / 2);
      const down = new TWEEN.Tween(particle.position).to({z: end.z}, this.duration / 2);
      const move = new TWEEN.Tween(particle.position).to({x: end.x, y: end.y}, this.duration).onComplete(() => {
        particle.visible = false;
      });

      up.chain(down).start();
      move.start();
    })

  }

  stop() {
    this.mesh.visible = false;
  }

}

class PolymericParticles {
  particles = new THREE.Group();
  count = 15;
  interval = 15;

  texture = new THREE.CanvasTexture( this.generateSprite() );

  whiteMaterial = new THREE.SpriteMaterial( {
    map: this.texture,
    color: 0x00ff00,
    // blending: THREE.AdditiveBlending
  } );

  greenMaterial = new THREE.SpriteMaterial( {
    map: this.texture,
    color: 0xffffff,
  } )

  constructor() {
    for ( var i = 0; i < this.count; i++ ) {
      let particle = new THREE.Sprite( i % 3 ? this.whiteMaterial : this.greenMaterial );
      this.step( particle, i * this.interval );
      this.particles.add(particle);
    }
    this.particles.visible = false;
  }

  step(particle, delay) {
    const position = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(Math.random() * 0.2 + 0.4);
    
    particle.scale.set(0.03, 0.03, 0.03);
    particle.position.copy(position);
    particle.visible = false;

    new TWEEN.Tween(particle.position).delay(delay).to({x: 0, y: 0, z: 0}, this.count * this.interval).easing(TWEEN.Easing.Quadratic.In).start()
    .onStart(() => {
      particle.visible = true;
    })
    .onComplete(() => {
      this.step(particle, delay);
    })
  }

  generateSprite() {
    var canvas = document.createElement( 'canvas' );
    canvas.width = 16;
    canvas.height = 16;
    var context = canvas.getContext( '2d' );
    var gradient = context.createRadialGradient( canvas.width / 2, canvas.height / 2, 0, canvas.width / 2, canvas.height / 2, canvas.width / 2 );
    gradient.addColorStop( 0, 'rgba(255,255,255,1)' );
    gradient.addColorStop( 1, 'rgba(255,255,255,1)' );
    context.fillStyle = gradient;
    context.fillRect( 0, 0, canvas.width, canvas.height );
    return canvas;
  }
}

class Block {
  mesh = new THREE.Group();
  body = new CANNON.Body({
    mass: 0
  });

  constructor() {
    const cube = cubes[ Math.floor(Math.random() * cubes.length) ].clone();
    cube.position.z = 0.5;
    cube.castShadow = true;
    cube.receiveShadow = true;
    this.mesh.add(cube);
    this.body.addShape(new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5)), new CANNON.Vec3(0, 0, 0.5));
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
    this.mesh.position.z = 3;
    return new TWEEN.Tween(this.mesh.position).to({z: 0}, 800).easing(TWEEN.Easing.Bounce.Out).start();
  }
}

class Bottle {
  connected = false;

  boundingBox = new THREE.Box3();
  offset = null;

  mesh = new THREE.Group();
  bottle = new THREE.ObjectLoader().parse(require('./models/bottle.json'));

  body = new CANNON.Body({
    mass: 0.1,
  });

  polymeric = new PolymericParticles();
  waves = new Waves();
  sputtering = new SputteringParticles();

  constructor()  {
    
    this.mesh.add(this.bottle);
    this.mesh.position.z = 1;
    
    this.computeBoundingBox();
    const size = this.boundingBox.getSize();
    this.bottle.position.set(0, 0, size.z / 2);
    

    this.offset = new THREE.Vector3(0, 0, size.z / 2);
    this.body.addShape(new CANNON.Cylinder(size.x / 2, size.x / 2, size.z, 20));
    this.body.sleep();

    this.mesh.add(this.polymeric.particles);
    this.mesh.add(this.sputtering.mesh);
    this.mesh.add(this.waves.mesh);

  }

  update() {
    if (this.connected) {
      this.mesh.position.copy(new THREE.Vector3().copy(this.body.position).sub(this.offset.clone().applyQuaternion(this.body.quaternion)) )
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
    move = new TWEEN.Tween(this.mesh.position).to({x, y}, FLIP_DURATION);

    const axis = displacement.clone().normalize().applyAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI/2);
    
    const rotate = new TWEEN.Tween({angle: 0}).to({angle: Math.PI * 2}, FLIP_DURATION).easing(TWEEN.Easing.Quadratic.Out).onUpdate(({angle}) => {
      this.bottle.quaternion.setFromAxisAngle(axis, angle);
    }),
    up = new TWEEN.Tween(this.mesh.position).to({z: 1 + FLIP_HEIGHT}, FLIP_DURATION / 2).easing(TWEEN.Easing.Quadratic.Out),
    down = new TWEEN.Tween(this.mesh.position).to({z: 1}, FLIP_DURATION / 2).easing(TWEEN.Easing.Quadratic.In);
    up.chain(down);

    return [
      move, up, rotate
    ]
  }

  fall() {
    this.body.position.copy(this.mesh.position.clone().setZ(BLOCK_HEIGHT + this.offset.z));
    this.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 0), 0);
    this.body.wakeUp();
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
  score = 0;
  combo = 0;

  text = new ScoreText(this.score);
  gameOverText = new CenterText('GAME OVER');
  gameOver = false;
  
  time = 0;
  
  flipping = false;

  pause = false;

  updates = [];

  world = new CANNON.World()

  renderer = new THREE.WebGLRenderer({antialias: true, alpla: true})

  scene = new THREE.Scene();

  camera = new THREE.OrthographicCamera(FRUSTUM_WIDTH / -2, FRUSTUM_WIDTH / 2, FRUSTUM_HEIGHT / 2, FRUSTUM_HEIGHT / -2, -40, 1000);

  bottle = new Bottle();

  light = new THREE.DirectionalLight(0xffffff, 0.28);

  blocks = [];

  UI = new THREE.Group();
  canvas = new Canvas();

  down$ =  Rx.Observable.merge(
    Rx.Observable.fromEvent(document, 'mousedown'),
    Rx.Observable.fromEvent(document, 'touchstart')
  ).do(e => { e.preventDefault(); });

  up$ = Rx.Observable.merge(
    Rx.Observable.fromEvent(document, 'mouseup'),
    Rx.Observable.fromEvent(document, 'touchend')
  ).do(e => { e.preventDefault(); });

  constructor() {
    //renderer
    this.renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
    // this.renderer.shadowMap.enabled = true;
    // this.renderer.clearColor = 0xffffff;

    const canvas = this.renderer.domElement;
    canvas.style.height = '100%';
    canvas.style.width = '100%';
    body.appendChild(canvas);

    //scene
    this.scene.receiveShadow = true;
    
    //helper
    
    // const gridHelper = new THREE.GridHelper(1000, 500);
    // gridHelper.rotateX(Math.PI/-2)
    // this.scene.add(gridHelper);
    // this.scene.add(new THREE.AxisHelper(1000));
    this.renderer.setPixelRatio(Math.min(2,window.devicePixelRatio));

    //lights
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));

    
    this.light.position.set(2, -10, 15);
    this.light.castShadow = true;
    // this.light.target = this.bottle.mesh;
    this.scene.add(this.light);
    this.scene.add(this.light.target);

    this.camera.position.set(-5, -6, 7);
    this.camera.castShadow = true;
    this.camera.receiveShadow = true;
    this.camera.up.set(0, 0, 1);
    this.camera.lookAt(new THREE.Vector3(0,0,0))

    
    this.UI.position.set(FRUSTUM_WIDTH/-2, FRUSTUM_HEIGHT/-2, 0);
    
    this.camera.add(this.UI);
    
    this.UI.add(this.gameOverText.mesh);
    this.UI.add(this.text.mesh);

    this.scene.add(this.camera);

    //graphics ground
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshLambertMaterial({color: 0xfedcba}));
    ground.receiveShadow = true;
    ground.castShadow = true;
    this.scene.add(ground);

    //background
    const background = new THREE.Mesh(new THREE.IcosahedronGeometry(200), new THREE.MeshLambertMaterial({color: 0xeeeeee, side: THREE.BackSide}));
    // this.scene.add(background);

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



    const _flipped$ = this.down$
      .filter(() => (!this.gameOver && !this.flipping))
      .map(() => {
        this.flipping = true;
        this.bottle.polymeric.particles.visible = true;
        this.bottle.sputtering.stop();
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
        this.bottle.polymeric.particles.visible = false;
        tweens.forEach(tween => {
          tween.stop();
        })

        const interval = Math.min(5000, this.time - time);
        [
          ...this.currentBlock.bounce(),
          ...this.bottle.bounce(),
        ].map( tween => ( tween.start() ) );

        const direction = this.nextBlock.mesh.position.clone().sub(this.bottle.mesh.position.clone().setZ(0)).normalize();

        const completes = this.bottle.flip(direction.multiplyScalar(interval / 1000 * FLIP_DISTANCE_UNIT))
          .map( tween => ( tween.start() ) )
          .map(tween => {
            return Rx.Observable.bindCallback(tween.onComplete.bind(tween))()
          });

        return completes;
      })
      .debounce(completes => {
        return Rx.Observable.merge(...completes).last()
      })
      .do(() => {
        this.flipping = false;
        const position = this.bottle.mesh.position.clone();
        position.z = 0;
        if (position.clone().sub(this.currentBlock.mesh.position).length() <= 0.5) {

        } else {
          const offset = position.clone().sub(this.nextBlock.mesh.position).length();
          if ( offset > 0.5 ) {
            //game over
            this.bottle.fall();

            this.gameOverText.mesh.visible = true;
            this.gameOver = true;

          } else {
            if (Math.abs(offset) < 0.08) {
              this.bottle.waves.wave(++ this.combo);
            } else {
              this.combo = 0;
            }
            this.text.text = (this.score += Math.pow(2, this.combo));
            

            this.bottle.sputtering.emit();
            this.createBlock();
            this.moveCamera();
          }
        }
      }).map((val ,index) => (index));

      _flipped$.subscribe(console.log);
      

      this.down$.filter(() => (this.gameOver)).do(() => {
        this.gameOver = false;
        this.gameOverText.mesh.visible = false;
        this.combo = 0;
        this.score = 0;
        this.text.text = 0;
        this.blocks.forEach(block => {
          this.remove(block);
        })
        this.blocks.length = 0;
        this.createBlock();
        this.createBlock();
        this.bottle.mesh.position.set(0, 0, 1);
        this.bottle.mesh.quaternion.set(0,0,0,0);
        this.bottle.connected = false;
        this.moveCamera(false);
      }).subscribe();
  }



  createBlock() {
    let block = new Block();
    if (this.blocks.length) {
        const direction = Math.random() > 0.5 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
        const last = this.blocks[this.blocks.length - 1];
        const position = last.mesh.position.clone().add(direction.multiplyScalar(Math.random() * 1.2 + 1.2));
        block.body.position.copy(position);
        block.mesh.position.copy(position);
        block.down();
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

  moveCamera(animate = true) {
    const position = this.blocks.length >= 2 ? this.nextBlock.mesh.position.clone().setZ(0).add(this.currentBlock.mesh.position.clone().setZ(0)).divideScalar(2) : new THREE.Vector3();
    const cameraTarget = new THREE.Vector3(-5, -6, 8).add(position);
    if (animate) {
      new TWEEN.Tween(this.camera.position).to(cameraTarget, 500).easing(TWEEN.Easing.Quadratic.Out).start();
    } else {
      this.camera.position.copy(cameraTarget);
    }
    
    this.light.position.copy(new THREE.Vector3(2, -10, 15).add(position));
    this.light.target.position.copy(position);
  }

  add(object) {
    this.world.addBody(object.body);
    this.scene.add(object.mesh);
  }

  remove(object) {
    this.world.remove(object.body);
    this.scene.remove(object.mesh);
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
    this.bottle.update();
    this.render();
  }

}

new Game().start();