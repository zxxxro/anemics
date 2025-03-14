import { ConstructorType } from '@zxxxro/commons';

export class Framer {
  public static readonly model: unique symbol = Symbol('MODEL')

  public static models: Map<string | symbol, ConstructorType<any>> = new Map();
  
  public static set(targetName: string | symbol, target: ConstructorType<any>): Map<string | symbol, ConstructorType<any>> {
    return Framer.models.set(targetName, target)
  }
}

export default Framer