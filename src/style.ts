import styled from 'styled-components';

const appBackground = "#000000";
const appForeground = "#ffffff";
const appFontFamily = "monospace";

export const PromptDiv = styled.div`
    display: flex;
`;
export const PromptInput = styled.input`
    flex-grow: 1;
    background-color: ${appBackground};
    color: ${appForeground};
    border: none;
    font-family: ${appFontFamily};
    padding: 0;
`;

export const App = styled.div`
    max-width: 900px;
    height: 100%;
    overflow: auto;
    margin: 0 auto;
    font-family: ${appFontFamily};
`;

export const PrefixSpan = styled.span`
    padding-right: 1ex;
`;

export const PreWrapDiv = styled.div`
    white-space: pre-wrap;
    display: inline;
`