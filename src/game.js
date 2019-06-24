import './index.css';

import * as THREE from 'three';
import * as CANNON from 'cannon';
import TWEEN from '@tweenjs/tween.js';
import Rx from 'rxjs/Rx';

import Twister from 'mersenne-twister';


const body = window.document.body,
      BODY_WIDTH = Math.min(body.offsetWidth, 540),
      BODY_HEIGHT = body.offsetHeight,
      ASPECT = BODY_WIDTH / BODY_HEIGHT,
      SCREEN_HEIGHT = BODY_HEIGHT,
      SCREEN_WIDTH = SCREEN_HEIGHT * ASPECT,
      FRUSTUM_HEIGHT = 6,
      FRUSTUM_WIDTH = FRUSTUM_HEIGHT * ASPECT,
      FRUSTUM_SCALE = FRUSTUM_HEIGHT / SCREEN_HEIGHT;

const FLIP_DISTANCE_UNIT = 2.5,
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
  { model: objectLoader.parse(require('./models/safe.json')), stayScore: 2, prob: 2 },
  { model: objectLoader.parse(require('./models/microwave_oven.json')), stayScore: 0, prob: 3 },
  { model: objectLoader.parse(require('./models/desk.json')), stayScore: 0, prob: 3 },
  { model: objectLoader.parse(require('./models/magic.json')), stayScore: 8, prob: 1 },
  { model: objectLoader.parse(require('./models/logo.json')), stayScore: 32, prob: 1 },
  { model: objectLoader.parse(require('./models/steve.json')), stayScore: 16, prob: 1 },
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
      '+0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ '.split('').forEach(key => {
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

class AddScoreText {
  text = new ShadowText('0');
  mesh = this.text.mesh;
  
  constructor() {
    this.mesh.scale.set(3,3,3);
    this.mesh.position.set(0,0,1);
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

  stayScore = 0;
  scale = 1;

  constructor(cube, scale = 1) {
    this.scale = scale;
    this.stayScore = cube.stayScore;
    const model = cube.model.clone();
    model.position.z = 0.5;
    model.castShadow = true;
    model.receiveShadow = true;
    this.mesh.add(model);

    this.mesh.scale.set(scale, scale, 1);
    this.body.addShape(new CANNON.Box(new CANNON.Vec3(scale / 2, scale / 2, 0.5)), new CANNON.Vec3(0, 0, 0.5));
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
    this.mesh.visible = true;
    return new TWEEN.Tween(this.mesh.position).to({z: 0}, 800).easing(TWEEN.Easing.Bounce.Out).start();
  }

  canHold(position) {
    const offset = position.clone().sub(this.mesh.position).setZ(0);
    return (Math.abs(offset.x) <= this.scale / 2 && Math.abs(offset.y) < this.scale / 2)
  }

  hitCenter(position) {
    const offset = position.clone().sub(this.mesh.position).setZ(0);
    return offset.length() < 0.08 * this.scale;
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
    this.bottle.position.set(0, 0, - this.boundingBox.min.z);
    

    this.offset = new THREE.Vector3(0, 0, - this.boundingBox.min.z);
    
    const _size = new CANNON.Vec3().copy(size.clone().multiplyScalar(0.5));

    this.body.addShape(new CANNON.Box(_size));
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
    return this.boundingBox;
  }

  flip(distance, direction) {
    const displacement = direction.clone().multiplyScalar(distance);

    // 翻滚
    const tumbleAxis = direction.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI/2).normalize();

    // 移动
    const {x, y} = this.mesh.position.clone().add(displacement),
    move = new TWEEN.Tween(this.mesh.position).to({x, y}, FLIP_DURATION);

    const rotate = new TWEEN.Tween({angle: 0, progress: 0}).to({angle: Math.PI * 2, progress: 1}, FLIP_DURATION).easing(TWEEN.Easing.Quadratic.Out).onUpdate(({angle, progress}) => {
      const tumble = new THREE.Quaternion().setFromAxisAngle(tumbleAxis, angle);
      this.bottle.quaternion.copy(tumble);
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

export default class Game extends THREE.EventDispatcher {
  score = 0;
  combo = 0;

  scroreText = new ScoreText(this.score);
  gameOverText = new CenterText('GAME OVER');
  addScoreText = new AddScoreText();

  gameOver = false;
  
  time = 0;
  
  flipping = false;
  falling = false;

  pause = false;

  updates = [];

  world = new CANNON.World()

  renderer = new THREE.WebGLRenderer({antialias: true, alpla: true})

  scene = new THREE.Scene();

  camera = new THREE.OrthographicCamera(FRUSTUM_WIDTH / -2, FRUSTUM_WIDTH / 2, FRUSTUM_HEIGHT / 2, FRUSTUM_HEIGHT / -2, -40, 1000);

  bottle = new Bottle();

  light = new THREE.DirectionalLight(0xffffff, 0.28);

  blocks = [];

  steps = [];

  step = 0;

  UI = new THREE.Group();

  down$ =  Rx.Observable.merge(
    Rx.Observable.fromEvent(this.renderer.domElement, 'mousedown'),
    Rx.Observable.fromEvent(this.renderer.domElement, 'touchstart')
  ).do(e => { e.preventDefault(); });

  up$ = Rx.Observable.merge(
    Rx.Observable.fromEvent(this.renderer.domElement, 'mouseup'),
    Rx.Observable.fromEvent(this.renderer.domElement, 'touchend')
  ).do(e => { e.preventDefault(); });

  update$ = new Rx.Subject();

  constructor() {
    super();
    this.resestRandom();

    //renderer
    this.renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
    // this.renderer.shadowMap.enabled = true;
    // this.renderer.clearColor = 0xffffff;

    // const canvas = this.renderer.domElement;
    // canvas.style.height = '100%';
    // canvas.style.width = '100%';
    // body.appendChild(canvas);

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

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(FRUSTUM_WIDTH, FRUSTUM_HEIGHT), new THREE.MeshLambertMaterial({color: 0xfedcba}));
    ground.position.z = -20;
    this.camera.add(ground);
    
    this.camera.position.set(-5, -6, 7);
    this.camera.castShadow = true;
    this.camera.receiveShadow = true;
    this.camera.up.set(0, 0, 1);
    this.camera.lookAt(new THREE.Vector3(0,0,0))

    
    this.UI.position.set(FRUSTUM_WIDTH/-2, FRUSTUM_HEIGHT/-2, 0);
    
    this.camera.add(this.UI);
    
    this.UI.add(this.gameOverText.mesh);
    this.scroreText.mesh.visible = false;
    this.UI.add(this.scroreText.mesh);
    this.scene.add(this.camera);

    
    //graphics ground


    //background
    // const background = new THREE.Mesh(new THREE.IcosahedronGeometry(100), new THREE.MeshLambertMaterial({color: 0xeeeeee, side: THREE.BackSide}));
    // this.scene.add(background);

    this.world.gravity.set(0, 0, -9.8);

    const _ground = new CANNON.Body({
      mass: 0,
    });

    _ground.addShape(new CANNON.Plane(), new CANNON.Vec3(0, 0, 0))
    this.world.addBody(_ground);



    this.add(this.bottle);

    this.restart(20);
    this.scroreText.mesh.visible = false;

    const _flipped$ = this.down$
      .filter(() => (!this.falling && !this.gameOver && !this.flipping))
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
        this.steps.push([time, this.time]);

        [
          ...this.currentBlock.bounce(),
          ...this.bottle.bounce(),
        ].map( tween => ( tween.start() ) );


        const direction = this.nextBlock.mesh.position.clone().sub(this.bottle.mesh.position.clone()).setZ(0).normalize();
        const distance = interval / 1000 * FLIP_DISTANCE_UNIT;
        
        const completes = this.bottle.flip(distance, direction)
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
        
        
        if (this.currentBlock.canHold(this.bottle.mesh.position)) {
          this.combo = 0;
        } else {
          
          if ( !this.nextBlock.canHold(this.bottle.mesh.position) ) {
            //game over
            this.bottle.fall();
            this.falling = true;

            //this.gameOverText.mesh.visible = true;
            this.gameOver = true;
            setTimeout(() => {
              this.falling = false;
              this.scroreText.mesh.visible = false;
              this.dispatchEvent({type: 'gameover'});
            }, 800);
          } else {
            if (this.nextBlock.hitCenter(this.bottle.mesh.position)) {
              this.bottle.waves.wave(++ this.combo);
            } else {
              this.combo = 0;
            }
            

            this.scroreText.text = (this.score += (1 + Math.min(5, this.combo)));
            

            this.bottle.sputtering.emit();
            this.createBlock();
            this.nextBlock.down();
            this.moveCamera();

            const len = this.steps.length;
            setTimeout(() => {
              if (this.steps.length === len && !this.flipping && !this.falling && !this.gameOver) {
                this.addScore(this.currentBlock.stayScore);
              }
            }, 2000);
          }
        }
      }).map((val ,index) => (index));

      _flipped$.subscribe();
      

  }

  addScore(score) {
    if (score !== 0) {
      this.scroreText.text = (this.score += score);
    }
  }

  createBlock() {
    const cube = this.randomCube();
    const scale = 1 - this.random() * this.difficulty * 0.4;
    let block = new Block(cube, scale);
    if (this.blocks.length) {
        const direction = this.random() > 0.5 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
        const last = this.blocks[this.blocks.length - 1];
        const position = last.mesh.position.clone().add(direction.multiplyScalar(1.2 + this.random() * (1.2 + this.difficulty * 1.2))).setZ(0);
        block.body.position.copy(position);
        block.mesh.position.copy(position);
    } else {
        block.body.position.set(0, 0, 0);
        block.mesh.position.set(0, 0, 0);
    }
    block.mesh.visible = false;
    this.blocks.push(block);
    this.add(block);

    return block;
  }

  get currentBlock() {
      return this.blocks[this.blocks.length - 3];
  }

  get nextBlock() {
      return this.blocks[this.blocks.length - 2];
  }

  get towardsBlock() {
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

    this.addScoreText.mesh.lookAt(new THREE.Vector3(-5, -6, 8));
    
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

  restart(seed = Math.floor(Math.random() * 0xffffff)) {
    this.resestRandom(seed);
    this.gameOver = false;
    this.scroreText.mesh.visible = true;
    this.gameOverText.mesh.visible = false;
    this.combo = 0;
    this.score = 0;
    this.scroreText.text = 0;
    this.blocks.forEach(block => {
      this.remove(block);
    })
    this.steps = [];
    this.blocks.length = 0;
    this.createBlock().mesh.visible = true;
    this.createBlock().down();
    this.createBlock();
    this.bottle.mesh.position.set(0, 0, 1);
    this.bottle.mesh.quaternion.set(0, 0, 0, 0);
    this.bottle.bottle.quaternion.setFromAxisAngle(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(1, 0, 0).angleTo( this.nextBlock.mesh.position.clone().sub(this.currentBlock.mesh.position).setZ(0).normalize() )
    );
    this.bottle.connected = false;
    this.moveCamera(false);
    
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
    this.update$.next();
    this.render();
  }

  get difficulty() {
    const v = 1 - Math.pow(0.5, this.steps.length / 28);
    return v;
  }

  resestRandom(seed) {
    const twister = new Twister(seed);
    this.random = () => {
      const value = twister.random();
      return value;
    }
  }

  randomCube() {
    let sum = 0;
    cubes.forEach(i => {
      sum += i.prob;
    });

    let random = Math.floor(this.random() * (sum + 1));
    let index = 0;
    for(let i = 0; i < cubes.length; ++i) {
      random -= cubes[i].prob;
      if (random <= 0) {
        index = i;
        break;
      }
    }

    return cubes[index];
  }
}