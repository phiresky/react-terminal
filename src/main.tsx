import * as React from "react";
import { render } from "react-dom";
import * as mobx from "mobx";
import * as mobxReact from "mobx-react";
import './style.scss';

@mobxReact.observer
class GUI extends React.Component<{}, {}> {
    @mobx.observable counter = 0;
    render() {
        return (
            <div>
                <h1>MobX React Boilerplate</h1>
                <hr />
                <p>Counter: {this.counter}</p>
                <button onClick={() => this.counter++}>Increment</button>
            </div>
        );
    }
}

render(<GUI />, document.getElementById("app"));