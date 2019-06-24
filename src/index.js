import BottleFlip from './game';
import React from 'react';
import ReactDOM from 'react-dom';
import { rem } from './utils';
import glamorous, {Div} from 'glamorous';

const game = new BottleFlip();
game.start();

const Button = glamorous.div({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  cursor: 'pointer',
  backgroundColor: '#fdfdfd',
  color: '#000',
  fontWeight: 'bold',
  fontSize: rem(54),
  lineHeight: 'normal',
  height: rem(156),
  width: rem(512),
  borderRadius: rem(156 / 2),
  margin: '0 auto',
  boxShadow: `0 ${rem(4)} ${rem(12)} ${rem(4)} rgba(113, 113, 113, 0.4)`
});

const Wrapper = glamorous.div({
  width: '10rem',
  margin: '0 auto',
  position: 'relative',
  minHeight: '100%',
})

class Landing extends React.Component {
  handleStartClick = e => {
    this.props.onStart();
  }

  render() {
    return <div style={{ position: 'fixed', left: 0, right: 0, top: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.3)', color: '#ffffff' }}>
      <Wrapper>
      <Div fontSize={rem(148)} fontWeight="bold" textAlign="center" paddingTop={rem(340)} >Bottle Flip</Div>
      <Div position="absolute" bottom={rem(259)} width="100%">
        <Div marginTop={rem(128)}>
          <Button onClick={this.handleStartClick}>Start Game</Button>
        </Div>
      </Div>
      </Wrapper>
  </div>;
  }
}

class Game extends React.Component {
  container = null;
  state = {
    started: false
  }
  onRef = ref => {
    this.container = ref;
  }

  handleGameOver = async () => {
    this.props.onGameOver();
  }

  componentDidMount() {
    this.container.appendChild(game.renderer.domElement);
    game.addEventListener('gameover', this.handleGameOver);
  }

  componentWillUnmount() {
    this.container.removeChild(game.renderer.domElement);
    game.removeEventListener('gameover', this.handleGameOver);
  }

  render() {
    return <Wrapper>
      <div ref={this.onRef}></div>
    </Wrapper>
  }
}

class Score extends React.Component {
  render() {
    return <div style={{ position: 'fixed', left: 0, right: 0, top: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.8)', color: '#ffffff' }}>
      <Wrapper>
      <Div textAlign="center" fontSize={rem(34)} paddingTop={rem(200)}>Round Score</Div>
      <Div textAlign="center" fontSize={rem(146)} fontWeight="bold" marginTop={rem(20)} marginBottom={rem(40)}>{ this.props.round }</Div>
      <Div position="absolute" height={rem(415)} bottom="0" width="100%">
        <Button onClick={this.props.onRestart}>Restart</Button>
        <Div fontSize={rem(36)} textAlign="center" position="absolute" width="100%" bottom={rem(70)} >Highest Score: { this.props.highest }</Div>
      </Div>
      </Wrapper>
    </div>
  }
}

const STATE_LANDING = 'landing';
const STATE_GAME = 'game';
const STATE_GAMEOVER = 'gameover';

class App extends React.Component {
  state={
    state: STATE_LANDING,
    highest: parseInt(localStorage.getItem('highest') || '0', 10),
    round: 0,
  }

  renderUI() {
    switch (this.state.state) {
      case STATE_GAMEOVER:
        return (
          <Score
            round={this.state.round}
            highest={this.state.highest}
            onRestart={
              () => {
                game.restart();
                this.setState({state: STATE_GAME});
              }
            }
          />
        );
      case STATE_LANDING:
          return (
            <Landing
              onStart={
                () => {
                  game.restart();
                  this.setState({state: STATE_GAME});
                }
              }
            />
          );
      case STATE_GAME:
      default:
          return null;
    }
  }

  render() {
    return (
      <React.Fragment>
        <Game
          onGameOver={
            () => {
              let highest = this.state.highest;
              if (game.score > this.state.highest) {
                highest = game.score;
                localStorage.setItem('highest', highest.toString())
              }
              this.setState({highest, round: game.score, state: STATE_GAMEOVER});
            }
          }
        />
        { this.renderUI() }
      </React.Fragment>
    );
  }
}


ReactDOM.render(<App/>, document.getElementById('root'));
