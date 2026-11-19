' Dados da Goldcard para o botão "Entrar com a Goldcard" (1.0).
' Os valores entram só na hora de empacotar (scripts/roku-pack.mjs, secrets do
' GitHub GOLDCARD_SERVER/USER/PASS). No repositório ficam vazios.
function goldcard() as object
    return { server: "__GC_SERVER__", user: "__GC_USER__", pass: "__GC_PASS__" }
end function
