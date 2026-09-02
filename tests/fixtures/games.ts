export const CLEAN_GAME = `[Event "Clean"]
[White "Alpha"]
[Black "Beta"]
[WhiteElo "1600"]
[BlackElo "1550"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 1-0`;
export const QUEEN_BLUNDER = `[Event "Queen blunder"]
[Result "0-1"]

1. e4 e5 2. Qh5 Nc6 3. Qxe5+ Nxe5 0-1`;
export const EN_PASSANT = `[Event "En passant"]
[Result "1/2-1/2"]

1. e4 a6 2. e5 d5 3. exd6 1/2-1/2`;
export const PROMOTION = `[Event "Promotion"]
[SetUp "1"]
[FEN "8/P7/8/8/8/8/7k/5K2 w - - 0 1"]
[Result "1-0"]

1. a8=Q 1-0`;
export const CHECKMATE = `[Event "Mate"]
[Result "0-1"]

1. f3 e5 2. g4 Qh4# 0-1`;
export const DRAW = `[Event "Draw"]
[Result "1/2-1/2"]

1. Nf3 Nf6 2. Ng1 Ng8 1/2-1/2`;
export const TACTICAL_SACRIFICE = `[Event "Sacrifice"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Nd4 4. Nxe5 Qg5 5. Bxf7+ Ke7 6. O-O Qxe5 1-0`;
export const MISSED_MATE = `[Event "Missed mate"]
[Result "1/2-1/2"]

1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0`;
export const BLACK_MISTAKE = `[Event "Black mistake"]
[Result "1-0"]

1. d4 d5 2. c4 Bf5 3. cxd5 Bxb1 4. Qa4+ c6 5. Rxb1 1-0`;
