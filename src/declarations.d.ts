/**
 * declarations for untyped modules
 */

declare module "*.png" {
    var x: string;
    export = x;
}

declare module "clean-webpack-plugin";