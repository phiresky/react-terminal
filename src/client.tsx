import * as React from "react";
import { render } from "react-dom";
import * as mobx from "mobx";
import * as mobxReact from "mobx-react";
import './style.scss';
import * as serverType from './server';
import { observable } from "mobx";
import { observer } from "mobx-react";
import { CommandOutput, StreamingOutput } from "./server";
import { PromptInput, App, PromptDiv, PrefixSpan, PreWrapDiv } from "./style";
import { makeClient } from './remotify';
import * as util from './util';
util.polyfillAsyncIterator();
type CanDisplay = {
    quality: number // 
};

interface OutputDisplayer extends React.ComponentClass<{ data: CommandOutput }> {
    canDisplay(output: CommandOutput): CanDisplay;
}



@observer
class GenericStreamingDisplayer extends React.Component<{ data: CommandOutput }, {}> {
    static canDisplay(output: CommandOutput): CanDisplay {
        if (output.type === "StreamingOutput") return { quality: 1 };
        else return { quality: 0 };
    }
    render() {
        const { data } = this.props;
        if (data.type !== 'StreamingOutput') throw Error("invalid");
        return (
            <div>
                {data.data.map((d, i) => <AutoChooseDisplayer key={i} data={d} />)}
                {!data.done && <i>Running...</i>}
            </div>
        )
    }
}
@observer
class GenericStringDisplayer extends React.Component<{ data: CommandOutput }, {}> {
    static canDisplay(output: CommandOutput): CanDisplay {
        if (output.type === "SingleOutput" && typeof output.data === "string") return { quality: 1 };
        else return { quality: 0 };
    }
    render() {
        const { data } = this.props;
        if (typeof data.data !== 'string') throw Error("invalid");
        return (
            <PreWrapDiv>
                {data.data}
            </PreWrapDiv>
        )
    }
}

@observer
class FilenameDisplayer extends React.Component<{ data: CommandOutput }, {}> {
    static canDisplay(output: CommandOutput): CanDisplay {
        if (output.type === "SingleOutput" && output.meta === "filename") return { quality: 2 };
        else return { quality: 0 };
    }
    render() {
        const { data } = this.props;
        return (
            <div>
                [[Filename: {data.data}]]
            </div>
        )
    }
}


@observer
class AutoChooseDisplayer extends React.Component<{ data: CommandOutput }, {}> {
    render() {
        const { data } = this.props;
        const rated = displayers.map(displayer => ({ displayer, quality: displayer.canDisplay(data).quality }));
        const best = rated.sort((a, b) => b.quality - a.quality)[0];
        if (!best) return <div>No displayers found</div>;
        if (best.quality === 0) return <div>No matching displayer found</div>;
        const Displayer = best.displayer;
        return (
            <Displayer data={data} />
        );
    }
}

const displayers: OutputDisplayer[] = [
    GenericStreamingDisplayer,
    GenericStringDisplayer,
    FilenameDisplayer
];

@observer
class SingleCommandGUI extends React.Component<{ input: string, output: CommandOutput }, {}> {
    render() {
        const { input, output } = this.props;
        return (
            <div>
                <div><PromptPrefix /><span>{input}</span>
                    {<AutoChooseDisplayer data={output} />}
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

@observer
class GUI extends React.Component<{}, {}> {
    @observable history = [] as { input: string, output: StreamingOutput }[];

    server = (async () => {
        const server = await makeClient<typeof serverType>();
        return server;
    })();
    run = async (command: string) => {
        const server = await this.server;
        let ele = mobx.observable({
            input: command,
            output: {
                type: "StreamingOutput",
                data: [] as CommandOutput[],
                done: false as boolean
            } as StreamingOutput
        });
        this.history.push(ele);
        for await (const res of await server.executeCommand({ type: "string", cmd: ele.input })) {
            ele.output.data.push(res);
        }
        ele.output.done = true;
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