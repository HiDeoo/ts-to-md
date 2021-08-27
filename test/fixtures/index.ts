import { C, D } from "./types";

/** Prop... */
type Id = number;

type Prout = {
  name: string;
  power: number;
};

interface Prout2 {}

/** Yhouououou */
type Roger = A & { plop: boolean };

interface A {
  id: Id | boolean | string;
  name: string;
}

/**
 * Describe B...
 */
interface B extends A {
  desc?: string | string[];
  /**
   * Describe enabled in B
   */
  enabled?: boolean;
}

interface BB extends B {
  plop: string;
}

interface T {
  do(arg: string): void;
}

interface T2 {
  dodo: (arg: string) => void;
}

interface E {
  test1?: string;
  test2: number;
}

interface F extends Omit<E, "test1"> {
  test1?: number;
}

/**
 * Options de mon super plugin....
 */
interface Options extends C, D, T, T2, F {
  // plop
  moreOptions: string[];
  /* prout */
  prop1: string | undefined;
  /**
   * kapoueeee
   * @default "pouet"
   */
  prop2?: string;
}

interface KeyPair<T, U> {
  key: T;
  value: U;
}
