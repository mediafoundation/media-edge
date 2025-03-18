# Fase de construcción
FROM node:18 AS build

WORKDIR /usr/src/app

# Copia los archivos de configuración y dependencias
COPY package*.json ./

# Instala solo las dependencias necesarias para producción
RUN npm install --omit=dev

# Copia el resto de los archivos con permisos adecuados
COPY --chown=node:node . ./

# Compila el código TypeScript
RUN npm run build

# Fase de producción
FROM node:18 AS production

WORKDIR /usr/src/app

# Copia las dependencias desde la fase de compilación
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/lib ./lib
COPY --from=build /usr/src/app/package*.json ./

# Establece el usuario node (mejor seguridad)
USER node

# Expone los puertos necesarios
EXPOSE 3000 7878

# Comando de inicio
CMD ["npm", "run", "start"]
