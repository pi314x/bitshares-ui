// How strong a password is (zxcvbn). The library is part of the app and loaded when a
// password field first needs it. It used to be fetched from a CDN at run time
// (`zxcvbn-async`), which put a third-party script on the page where the password is
// typed. Until it has loaded the score is -1, as the old wrapper reported.
type Scorer = (password: string, userInputs?: string[]) => {score: number};

let scorer: Scorer | null = null;
let loading: Promise<void> | null = null;

export function loadPasswordStrength(): Promise<void> {
    if (!loading) {
        loading = import(/* webpackChunkName: "zxcvbn" */ "zxcvbn").then(
            (module: any) => {
                scorer = (module.default || module) as Scorer;
            }
        );
    }
    return loading;
}

export function passwordStrength(password: string): {score: number} {
    return scorer ? scorer(password) : {score: -1};
}
