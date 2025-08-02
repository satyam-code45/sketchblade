"use client";

import { Button } from "./ui/button";
import { Input } from "./ui/input";

export default function AuthPage({ isSignIn }: { isSignIn: boolean }) {
  return (
    <div className="w-screen h-screen flex justify-center items-center">
      <div className="p-2 m-2 bg-white rounded">
        <div className="m-3 w-full">
          <Input type="text" placeholder="Email"></Input>
        </div>
        <div className="m-3 w-full">
          <Input type="text" placeholder="Password" ></Input>
        </div>
        <div className="m-3 w-full">
          <Button  className="w-full" onClick={() => {}}>{isSignIn ? "Sign In" : "Sign Up"}</Button>
        </div>
      </div>
    </div>
  );
}
