import { Kysely, type Generated, sql } from 'kysely';
import { LibsqlDialect } from '../src';
import { unlink } from 'node:fs/promises';
import { expect, test } from 'vitest';

interface Database {
	book: {
		id: Generated<number>;
		title: string;
	};
}

const testDb = test.extend<{ db: Kysely<Database> }>({
	// eslint-disable-next-line no-empty-pattern
	db: async ({}, use) => {
		await unlink('test.db').catch(() => {});

		const db = new Kysely<Database>({
			dialect: new LibsqlDialect({ url: 'file:test.db' }),
		});

		try {
			await sql`CREATE TABLE book (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT)`.execute(
				db,
			);
			await use(db);
		} finally {
			await db.destroy();
		}
	},
});

testDb('basic operations', async ({ db }) => {
	const { id } = await db
		.insertInto('book')
		.values({ title: 'Pride and Prejudice' })
		.returning('id')
		.executeTakeFirstOrThrow();

	const book = await db
		.selectFrom('book')
		.select(['id', 'title'])
		.where('book.id', '=', id)
		.executeTakeFirst();

	expect(book!.id).toStrictEqual(id);
	expect(book!.title).toStrictEqual('Pride and Prejudice');
});

testDb('transaction', async ({ db }) => {
	const id = await db.transaction().execute(async (txn) => {
		const { id } = await txn
			.insertInto('book')
			.values({ title: 'Sense and Sensibility' })
			.returning('id')
			.executeTakeFirstOrThrow();
		return id;
	});

	const book = await db
		.selectFrom('book')
		.select(['id', 'title'])
		.where('book.id', '=', id)
		.executeTakeFirst();

	expect(book?.id).toStrictEqual(id);
});
