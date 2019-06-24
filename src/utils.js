import flexible from './flexible';

export const Rem = option => {
    const _option = {
        remUnit: 75,
        remPrecision: 6,
    };

    option = Object.assign({}, _option, option)

    return x => {
        return parseFloat((x / option.remUnit).toFixed(option.remPrecision)).toString() + 'rem'
    }
}

export const rem = Rem({remUnit: 108});

export const px = x => (''+(!flexible.hairlines && x < 1 ? 1 : x)+'px');