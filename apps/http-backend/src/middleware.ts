import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "./congif";


export function middleware(req: Request, res: Response, next: NextFunction) {
    const token = req.headers["authorization"] ?? "";

    const decoded = jwt.verify(token,JWT_SECRET)
    if (decoded) {
        //@ts-ignore : TODO: Fix this?? 
        //Google how to update the strucure of the req in express
        req.userId = decoded.userId;
        next();
    }else{
        res.status(403).json({
            message: "Unauthorized"
        })
    }

}