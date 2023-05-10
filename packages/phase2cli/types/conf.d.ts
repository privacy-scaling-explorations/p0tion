declare module 'conf' {
    export interface ConfOptions {
        projectName: string;
        schema: object;
    }

    export class Conf {
        constructor(options: ConfOptions);
        get(key: string): any;
        set(key: string, value: any): void;
        delete(key: string): void;
        has(key: string): boolean;
    }

    export default Conf
}
