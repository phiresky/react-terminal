import * as React from "react";
import { render } from "react-dom";
import * as mobx from "mobx";
import * as mobxReact from "mobx-react";
import './style.scss';
import * as serverType from './server';
import { observable } from "mobx";
import { observer } from "mobx-react";
import { CommandOutput } from "./server";
import { PromptInput, App, PromptDiv, PrefixSpan, PreWrapDiv } from "./style";
import { makeClient } from './remotify';
import * as util from './util';
import * as types from './types';
import * as t from 'io-ts';

type validTypes = keyof typeof types;

util.polyfillAsyncIterator();
type CanDisplay = {
    quality: number // 
};

interface OutputDisplayer extends React.ComponentClass<{ type: string, data: any }> {
    canDisplay(output: validTypes): CanDisplay;
}

function Displayer<K extends validTypes>(s: K, quality: number) {
    return class Displayer extends React.Component<{ type: K, data: t.TypeOf<typeof types[K]> }, {}> {
        static canDisplay(type: validTypes): CanDisplay {
            if (s === "any") return { quality };
            return (type === s) ? { quality } : { quality: 0 };
        }
    }
}

@observer
class GenericStreamingDisplayer extends React.Component<{ data: ObservableOutput }, {}> {
    render() {
        const { data } = this.props;
        return (
            <div>
                {data.data.map((d, i) => <AutoChooseDisplayer key={i} type={data.$innerType} data={d} />)}
                {!data.done && <i>Running...</i>}
            </div>
        )
    }
}
//@observer
class GenericStringDisplayer extends Displayer("string", 1) {
    render() {
        const { data } = this.props;
        return (
            <PreWrapDiv>
                {data}
            </PreWrapDiv>
        )
    }
}

@observer
class FileStatDisplayer extends Displayer("FileStat", 1) {
    render() {
        const { data } = this.props;
        return (
            <div>
                {data.filename} ({data.stat.size} Byte)
            </div>
        )
    }
}


@observer
class AutoChooseDisplayer extends Displayer("any" as any, 1) {
    render() {
        const { data, type } = this.props;
        const rated = displayers.map(displayer => ({ displayer, quality: displayer.canDisplay(type).quality }));
        const best = rated.sort((a, b) => b.quality - a.quality)[0];
        if (!best) return <div>No displayers found</div>;
        console.log(rated);
        if (best.quality === 0) return <div>No matching displayer found</div>;
        const Displayer = best.displayer;
        return (
            <Displayer type={type} data={data} />
        );
    }
}

@observer
class GenericJSONDisplayer extends Displayer("any", 0.5) {
    render() {
        const { data, type } = this.props;
        return (
            <div>
                Generic display of `{type}`
                <pre>
                    {JSON.stringify(data, null, 3)}
                </pre>
            </div>
        )
    }
}

@observer
class NativeCommandDisplayer extends Displayer("ProcessOutput", 1) {
    render() {
        const { data } = this.props;
        return (
            <pre style={{ display: "inline", color: data.stream === "stderr" ? "red" : "white" }}>
                {data.text}
            </pre>
        )
    }
}

const displayers: OutputDisplayer[] = [
    GenericStringDisplayer,
    FileStatDisplayer,
    GenericJSONDisplayer,
    NativeCommandDisplayer
];

@observer
class SingleCommandGUI extends React.Component<{ input: string, output: ObservableOutput }, {}> {
    render() {
        const { input, output } = this.props;
        return (
            <div>
                <div><PromptPrefix /><span>{input}</span>
                    {<GenericStreamingDisplayer data={output} />}
                </div>
            </div>
        );
    }
}

function PromptPrefix() {
    return <PrefixSpan>$</PrefixSpan>;
}
@observer
class Prompt extends React.Component<{ run: (input: string) => void }, {}> {
    @observable input = "";
    onKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") this.props.run(this.input);
    }
    setFocus = (e: HTMLInputElement | null) => {
        if (e) e.focus();
    }
    render() {
        return (
            <div>
                <PromptDiv>
                    <PromptPrefix /><PromptInput value={this.input} onChange={e => this.input = e.currentTarget.value} onKeyUp={this.onKeyUp} innerRef={this.setFocus} />
                </PromptDiv>
            </div>
        );
    }
}

type ObservableOutput = {
    $innerType: string,
    data: any[],
    done: boolean
};
function makeObservable(c: CommandOutput): ObservableOutput {
    const ele = mobx.observable({
        $innerType: c.$innerType,
        data: [] as any[],
        done: false
    });
    (async function () {
        try {
            for await (const res of c.data) {
                ele.data.push(res);
            }
        } catch (e) {
            ele.$innerType = "error";
            ele.data.push(e);
        }
        ele.done = true;
    })();
    return ele;
}

@observer
class GUI extends React.Component<{}, {}> {
    @observable history = [] as { input: string, output: ObservableOutput }[];

    server = (async () => {
        const server = await makeClient<typeof serverType>();
        return server;
    })();
    run = async (command: string) => {
        const server = await this.server;
        this.history.push({
            input: command,
            output: makeObservable(await server.executeCommand({ type: "string", cmd: command }))
        });
    }
    render() {
        const last = this.history.length > 0 ? this.history[this.history.length - 1] : null;
        return (
            <App>
                {this.history.map(({ input, output }) => <SingleCommandGUI input={input} output={output} />)}
                {!last || last.output.done ? <Prompt run={this.run} /> : <span />}
            </App>
        );
    }
}

Object.assign(window, { gui: render(<GUI />, document.getElementById("app")) });