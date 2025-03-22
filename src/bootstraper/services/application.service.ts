import type { InterceptorInterface } from '~/controller/interfaces.ts';

import * as uuid from '@std/uuid';
import { Container, ContainerInterface } from '@zxxxro/commons';

import Gateway from '~/controller/services/gateway.service.ts';
import Interceptor from '~/controller/services/interceptor.service.ts';
import Requester from '~/bootstraper/services/requester.service.ts';
import Responser from '~/bootstraper/services/responser.service.ts';

export class Application {

  static container: ContainerInterface

  constructor(public module: any) {
    Interceptor.construct(Application.container);
  }

  async listen(options: any, handler: (request: Request) => Promise<Response>): Promise<any> {
    return Deno.serve(options, handler);
  }

  async handler(request: Request): Promise<Response> {

    const requester = new Requester(request)

    const promises = [
      new Promise((resolve, reject) => {
        let traceId = request.headers.get('X-Request-Id');
    
        if (!traceId || !uuid.validate(traceId)) {
          traceId = crypto.randomUUID();
        }
    
        resolve({
          container: Container.create(traceId),
          extra: undefined,
          requester: requester,
          responser: new Responser(),
          traceId,
        })
      }),
      new Promise((resolve, reject) => {
        const endpoints = Gateway.endpoints.get(requester.method);
    
        if (endpoints) {
          const promises = []
          for (let index = 0; index < endpoints.length; index++) {
            promises.push(new Promise((resolve, reject) => {
                if (endpoints[index].handler.pattern.test(requester.url)) {
                  resolve(endpoints[index])
                } else {
                  reject()
                }
              })
            )
          }
    
          Promise.any(promises).then((endpoint: any) => {
            resolve(endpoint)
          }).catch((error) => {
            resolve(undefined)
          })
        }
      })
    ]

    return Promise.all(promises).then(async ([context, endpoint]: any) => {

      context.extra = endpoint

      try {
        for (const [key] of Container.artifactsByTag.get(Interceptor.thenTag) || []) {
          await Application.container.construct<InterceptorInterface>(key)?.onUse(context);
        }
      } catch (error: any) {
        context.responser.addMetadata('error', error);
  
        for (const [key] of Container.artifactsByTag.get(Interceptor.catchTag) || []) {
          await Application.container.construct<InterceptorInterface>(key)?.onUse(context);
        }
      }
  
      for (const [key] of Container.artifactsByTag.get(Interceptor.finallyTag) || []) {
        Application.container.construct<InterceptorInterface>(key)?.onUse(context);
      }
  
      return new Response(context.responser.body, {
        status: context.responser.status,
        statusText: context.responser.statusText,
        headers: context.responser.headers,
      });
    })
  }
}

export default Application;
