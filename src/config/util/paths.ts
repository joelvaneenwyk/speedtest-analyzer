import path from "path";

export const root = (pathToFile: string, filename?: string) =>
    path.resolve(__dirname, "../../..", filename ? `${pathToFile}/${filename}` : pathToFile);

/**
 * The paths to the frontend app and server
 * TODO: Automate path finding, consider *resolve*-like module
 */
export const paths = {
    source: {
        frontend: {
            app: root("src/frontend", "index.ts"),
            template: root("src/frontend", "index.html")
        }
    },
    public: {
        root: root("html"),
        html: root("html", "index.html")
    },
    config: {
        tsconfig: root("tsconfig.json")
    }
};
