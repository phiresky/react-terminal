import styled from 'styled-components';

const appBackground = "#000000";
const appForeground = "#ffffff";
const appFontFamily = "monospace";

export const PromptInput = styled.input`
    background-color: ${appBackground};
    color: ${appForeground};
    border: none;
    font-family: ${appFontFamily};
    padding: 0;
`;

export const App = styled.div`
    max-width: 900px;
    margin: 0 auto;
    font-family: ${appFontFamily};
`;