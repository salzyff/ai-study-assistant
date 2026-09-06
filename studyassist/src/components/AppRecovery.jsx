import { Component } from 'react';
export default class AppRecovery extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { console.error('Study AI rendering error:', error); }
  render() {
    if (this.state.failed) return <main className="app-recovery" role="alert"><h1>Let’s reopen your workspace</h1><p>This page ran into a problem. Your saved chats are still available.</p><button type="button" onClick={() => this.setState({ failed: false })}>Return to workspace</button><button type="button" onClick={() => window.location.reload()}>Reload</button></main>;
    return this.props.children;
  }
}
