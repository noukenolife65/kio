export class Left<E> {
  readonly kind: 'Left'  = 'Left';
  readonly value: E;
  constructor(value: E) {
    this.value = value;
  }
}

export class Right<A> {
  readonly kind: 'Right'  = 'Right';
  readonly value: A;
  constructor(value: A) {
    this.value = value;
  }
}

export type Either<E, A> = Left<E> | Right<A>;
