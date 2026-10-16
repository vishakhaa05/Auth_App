import xss from "xss";

const cleanObj = (obj) => {
    if (!obj) return obj;
    for (const key in obj) {
        if (typeof obj[key] === "string") {
            obj[key] = xss(obj[key]);
        } else if (typeof obj[key] === "object" && obj[key] !== null) {
            cleanObj(obj[key]);
        }
    }
    return obj;
};

export const xssSanitize = (req, res, next) => {
    if (req.body) cleanObj(req.body);
    if (req.query) cleanObj(req.query);
    if (req.params) cleanObj(req.params);
    next();
};
