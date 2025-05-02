// src/index.ts
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import userRouter from './routes/userRoutes';
import schoolRouter from './routes/schoolRoutes';
import studentRouter from './routes/studentRoutes';
import teacherRouter from './routes/teacherRoutes';
import parentRouter from './routes/parentRoutes';
import gradeRouter from './routes/gradeRoutes';
import classRouter from './routes/classRoutes';
import { logger } from './utils/setup';
import authRouter from './routes/authRoutes';

dotenv.config();

const app: Express = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/schools', schoolRouter);
app.use('/api/students', studentRouter);
app.use('/api/teachers', teacherRouter);
app.use('/api/parents', parentRouter);
app.use('/api/grades', gradeRouter);
app.use('/api/classes', classRouter);

// Error handling
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', { error: err.stack, path: req.path });
  res.status(500).json({ message: 'Something went wrong!' });
});

app.use('/', (req, res) => {
  res.send('hello');
});

const PORT: number = parseInt(process.env.PORT || '3000', 10);
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});