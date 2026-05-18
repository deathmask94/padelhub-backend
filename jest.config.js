const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  // 🌟 ESTA ES LA CLAVE: Le enseña a Jest a leer extensiones TS sin marearse con el bundler
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
}

module.exports = async () => {
  const jestConfig = await createJestConfig(config)();
  return {
    ...jestConfig,
    moduleNameMapper: {
      ...jestConfig.moduleNameMapper,
      '^@/(.*)$': '<rootDir>/$1',
    },
  };
}