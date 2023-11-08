import { getRelativePath } from '@kubb/core'
import { print } from '@kubb/parser'
import * as factory from '@kubb/parser/factory'
import { OperationGenerator as Generator, resolve } from '@kubb/swagger'
import { camelCase, pascalCase } from 'change-case'

import { TypeBuilder } from '../builders/index.ts'
import { pluginName } from '../plugin.ts'

import type { KubbFile } from '@kubb/core'
import type { FileResolver, Operation, OperationSchemas, Resolver } from '@kubb/swagger'
import type ts from 'typescript'
import type { FileMeta, Options as PluginOptions } from '../types.ts'

type Options = {
  mode: KubbFile.Mode
  enumType: NonNullable<PluginOptions['enumType']>
  dateType: NonNullable<PluginOptions['dateType']>
  optionalType: NonNullable<PluginOptions['optionalType']>
}

export class OperationGenerator extends Generator<Options> {
  resolve(operation: Operation): Resolver {
    const { pluginManager } = this.context

    return resolve({
      operation,
      resolveName: pluginManager.resolveName,
      resolvePath: pluginManager.resolvePath,
      pluginName,
    })
  }

  #printCombinedSchema(name: string, operation: Operation, schemas: OperationSchemas): string {
    const properties: Record<string, ts.TypeNode> = {
      'response': factory.createTypeReferenceNode(
        factory.createIdentifier(schemas.response.name),
        undefined,
      ),
    }

    if (schemas.request) {
      properties['request'] = factory.createTypeReferenceNode(
        factory.createIdentifier(schemas.request.name),
        undefined,
      )
    }

    if (schemas.pathParams) {
      properties['pathParams'] = factory.createTypeReferenceNode(
        factory.createIdentifier(schemas.pathParams.name),
        undefined,
      )
    }

    if (schemas.queryParams) {
      properties['queryParams'] = factory.createTypeReferenceNode(
        factory.createIdentifier(schemas.queryParams.name),
        undefined,
      )
    }

    if (schemas.headerParams) {
      properties['headerParams'] = factory.createTypeReferenceNode(
        factory.createIdentifier(schemas.headerParams.name),
        undefined,
      )
    }

    if (schemas.errors) {
      properties['errors'] = factory.createUnionDeclaration({
        nodes: schemas.errors.map(error => {
          return factory.createTypeReferenceNode(
            factory.createIdentifier(error.name),
            undefined,
          )
        }),
      })!
    }

    const namespaceNode = factory.createNamespaceDeclaration({
      name: operation.method === 'get' ? `${name}Query` : `${name}Mutation`,
      statements: Object.keys(properties).map(key => {
        const type = properties[key]
        if (!type) {
          return undefined
        }
        return factory.createTypeAliasDeclaration({
          modifiers: [factory.modifiers.export],
          name: pascalCase(key),
          type,
        })
      }).filter(Boolean),
    })

    return print(namespaceNode)
  }

  async all(): Promise<KubbFile.File | null> {
    return null
  }

  async get(operation: Operation, schemas: OperationSchemas, options: Options): Promise<KubbFile.File<FileMeta> | null> {
    const { mode, enumType, dateType, optionalType } = options
    const { pluginManager } = this.context

    const type = this.resolve(operation)

    const fileResolver: FileResolver = (name) => {
      // Used when a react-query type(request, response, params) has an import of a global type
      const root = pluginManager.resolvePath({ baseName: type.baseName, pluginName, options: { tag: operation.getTags()[0]?.name } })
      // refs import, will always been created with the SwaggerTS plugin, our global type
      const resolvedTypeId = pluginManager.resolvePath({
        baseName: `${name}.ts`,
        pluginName,
      })

      return getRelativePath(root, resolvedTypeId)
    }

    const source = new TypeBuilder({
      fileResolver: mode === 'file' ? undefined : fileResolver,
      withJSDocs: true,
      resolveName: pluginManager.resolveName,
      enumType,
      optionalType,
      dateType,
    })
      .add(schemas.pathParams)
      .add(schemas.queryParams)
      .add(schemas.headerParams)
      .add(schemas.response)
      .add(schemas.errors)
      .configure()
      .print()

    const combinedSchemaSource = this.#printCombinedSchema(type.name, operation, schemas)

    return {
      path: type.path,
      baseName: type.baseName,
      source: [source, combinedSchemaSource].join('\n'),
      meta: {
        pluginName,
        tag: operation.getTags()[0]?.name,
      },
    }
  }

  async post(operation: Operation, schemas: OperationSchemas, options: Options): Promise<KubbFile.File<FileMeta> | null> {
    const { mode, enumType, dateType, optionalType } = options
    const { pluginManager } = this.context

    const type = this.resolve(operation)

    const fileResolver: FileResolver = (name) => {
      // Used when a react-query type(request, response, params) has an import of a global type
      const root = pluginManager.resolvePath({ baseName: type.baseName, pluginName, options: { tag: operation.getTags()[0]?.name } })
      // refs import, will always been created with the SwaggerTS plugin, our global type
      const resolvedTypeId = pluginManager.resolvePath({
        baseName: `${name}.ts`,
        pluginName,
      })

      return getRelativePath(root, resolvedTypeId)
    }

    const source = new TypeBuilder({
      fileResolver: mode === 'file' ? undefined : fileResolver,
      withJSDocs: true,
      resolveName: pluginManager.resolveName,
      enumType,
      optionalType,
      dateType,
    })
      .add(schemas.pathParams)
      .add(schemas.queryParams)
      .add(schemas.headerParams)
      .add(schemas.request)
      .add(schemas.response)
      .add(schemas.errors)
      .configure()
      .print()

    const combinedSchemaSource = this.#printCombinedSchema(type.name, operation, schemas)

    return {
      path: type.path,
      baseName: type.baseName,
      source: [source, combinedSchemaSource].join('\n'),
      meta: {
        pluginName,
        tag: operation.getTags()[0]?.name,
      },
    }
  }

  async put(operation: Operation, schemas: OperationSchemas, options: Options): Promise<KubbFile.File<FileMeta> | null> {
    return this.post(operation, schemas, options)
  }
  async patch(operation: Operation, schemas: OperationSchemas, options: Options): Promise<KubbFile.File<FileMeta> | null> {
    return this.post(operation, schemas, options)
  }
  async delete(operation: Operation, schemas: OperationSchemas, options: Options): Promise<KubbFile.File<FileMeta> | null> {
    return this.post(operation, schemas, options)
  }
}
