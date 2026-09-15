"use client";

import StartScreen from "../start-screen";
import {markWelcomeSeen} from "../../lib/storage/userStore";

export default function StartPage(){
  return <StartScreen onEnter={()=>{markWelcomeSeen();window.location.assign("/")}}/>;
}
