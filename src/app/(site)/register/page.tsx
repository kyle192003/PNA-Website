import type { Metadata } from "next";

import { RegisterRedirect } from "./RegisterRedirect";



export const metadata: Metadata = {

  title: "Register",

};



export default function RegisterPage() {

  return <RegisterRedirect />;

}

