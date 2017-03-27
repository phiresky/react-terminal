const path = require('path');
const webpack = require('webpack');
const Html = require('html-webpack-plugin');
const Template = require('html-webpack-template');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const CleanWebpackPlugin = require('clean-webpack-plugin');


const prod = process.env.NODE_ENV === "production";
console.log("building in " + (prod ? "production mode" : "dev mode"));

module.exports = {
    entry: './src/main',
    output: {
        path: path.resolve(__dirname, 'build'),
        // add a hash to the file name to ensure the browser cache does not cache wrong versions
        filename: "[name].[hash].js",
    },
    // add a source map so we can see the original code locations for debugging
    devtool: "sourcemap",
    module: {
        rules: [
            {
                // normal style files
                test: /\.css$/,
                use: ExtractTextPlugin.extract({
                    fallback: "style-loader",
                    use: "css-loader"
                })
            },
            {
                // SASS styles
                test: /\.scss$/, use: ExtractTextPlugin.extract({
                    fallback: "style-loader",
                    use: ['css-loader', 'sass-loader']
                })
            },
            {
                // typescript
                test: /\.tsx?$/, use: 'awesome-typescript-loader',
                exclude: /node_modules/
            },
            {
                // for other files such as fonts
                // when importing these in JS, you will get a string that is the URL of the file in the build folder
                test: /\.(ttf|png|jpg|eot|svg|woff(2)?)(\?[a-z0-9=&.]+)?$/,
                use: {
                    loader: 'file-loader',
                    options: { name: "[name].[ext]" }
                }
            },
        ]
    },
    plugins: [
        new Html({
            inject: false,
            // use more flexible html-webpack-template
            // see https://github.com/jaketrent/html-webpack-template#basic-usage for more options
            template: Template,
            // add a div with this id in which we will mount our root react component
            appMountId: 'app',
            // webpage title
            title: 'MobX React Boilerplate',
            // set width=device-width header for mobile devices
            mobile: true,
            // remove additional newlines from the template
            // (https://github.com/jaketrent/html-webpack-template/issues/40)
            minify: {
                collapseWhitespace: true,
                preserveLineBreaks: true,
            },
        }),
        // extract all css code into an extra file
        new ExtractTextPlugin("[name].[hash].css"),
        // add additional plugins if we are running in production mode
        ...(prod ? [
            // clean the build folder so old files don't accumulate
            new CleanWebpackPlugin(['build'], {
                root: __dirname,
                verbose: true,
                dry: false,
                // our build folder is a git worktree checked out to the gh-pages branch (see build.js),
                // so don't remove the .git file in that folder
                exclude: [".git"],
            }),
            // e.g. React uses this to decide whether to check propTypes
            new webpack.DefinePlugin({
                'process.env': {
                    'NODE_ENV': JSON.stringify('production')
                }
            }),
            // minify and mangle all the code
            new webpack.optimize.UglifyJsPlugin(),
        ] : [])
    ],
    resolve: {
        // allow `require("./main")` to mean `require("./main.tsx"), etc.`
        extensions: ['.ts', '.tsx', '.js', '.jsx']
    },
}