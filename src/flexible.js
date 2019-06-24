

class Flexible {
  static MAX_WIDTH = 540;

  hairlines = false;
  width = 0;
  height = 0;
  
  docEl = document.documentElement;
  dpr = window.devicePixelRatio || 1;

  
  // set 1rem = viewWidth / 10
  setRemUnit = () => {
    this.width = Math.min(this.docEl.clientWidth, Flexible.MAX_WIDTH);
    this.height = this.docEl.clientHeight;
    const rem = this.width / 10;
    this.docEl.style.fontSize = rem + 'px';
  }

  constructor(onUpdate = () => {}) {
    this.onUpdate = onUpdate;

    this.setRemUnit();

    // reset rem unit on page resize
    window.addEventListener('resize', () => {
      this.setRemUnit();
      this.onUpdate();
    })
    window.addEventListener('pageshow', function (e) {
      if (e.persisted) {
        this.setRemUnit();
        this.onUpdate();
      }
    })

    // detect 0.5px supports
    if (this.dpr >= 2) {
      var fakeBody = document.createElement('body')
      var testElement = document.createElement('div')
      testElement.style.border = '.5px solid transparent'
      fakeBody.appendChild(testElement)
      this.docEl.appendChild(fakeBody)
      if (testElement.offsetHeight === 1) {
        this.hairlines = true;
      }
      this.docEl.removeChild(fakeBody)
    }
  }

  get state() {
    return {
      width: this.width,
      height: this.height,
      hairlines: this.hairlines,
      dpr: this.dpr,
    }
  }
}

export default new Flexible();