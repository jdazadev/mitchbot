/**
 * Seed script: Limpia TODA la base de datos y crea un usuario admin demo.
 * 
 * Ejecutar: pnpm seed  (desde apps/backend)
 */
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mitchbot';

async function seed() {
  console.log('\n🌱 Seed Script — MitchBot v2');
  console.log('============================\n');

  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db();

    // 1. Limpiar TODA la base de datos (incluye users, agents, projects, etc.)
    console.log('🗑️  Limpiando base de datos completa...');
    const collections = await db.listCollections().toArray();
    
    if (collections.length === 0) {
      console.log('   ℹ️  No hay colecciones que eliminar');
    } else {
      for (const col of collections) {
        await db.collection(col.name).drop();
        console.log(`   ❌ Colección "${col.name}" eliminada`);
      }
    }
    console.log('   ✅ Base de datos completamente limpia\n');

    // 2. Crear usuario admin demo
    console.log('👤 Creando usuario admin demo...');
    const hashedPassword = await bcrypt.hash('admin123', 12);

    const adminUser = {
      name: 'Admin Demo',
      email: 'admin@mitchbot.io',
      password: hashedPassword,
      role: 'admin',
      status: 'Active',
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection('users').insertOne(adminUser);
    console.log('   ✅ Usuario admin creado:');
    console.log('   📧 Email: admin@mitchbot.io');
    console.log('   🔑 Password: admin123');
    console.log('   👑 Rol: admin\n');

    // 3. Verificación final
    console.log('📊 Estado final de la base de datos:');
    const finalCollections = await db.listCollections().toArray();
    for (const col of finalCollections) {
      const count = await db.collection(col.name).countDocuments();
      console.log(`   📦 ${col.name}: ${count} documento(s)`);
    }

    console.log('\n🎉 Seed completado exitosamente!');
    console.log('================================');
    console.log('⚠️  Recuerda limpiar el localStorage del navegador o cerrar sesión');
    console.log('   para forzar un nuevo login.\n');

  } catch (error) {
    console.error('❌ Error en seed:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

seed();
