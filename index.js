- name: Baixar e Extrair Source Code Inteligente
  run: |
    echo "=============================================="
    echo "INICIANDO DETECÇÃO E DOWNLOAD DA SOURCE CODE"
    echo "=============================================="
    
    INPUT_URL="${{ github.event.inputs.zip_url }}"
    USER_AGENT="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    
    # 1. Tratamento avançado para links do MediaFire
    if [[ "$INPUT_URL" == *"mediafire.com"* ]]; then
      echo "[MediaFire] Detectado. Extraindo link de download direto..."
      HTML_CONTENT=$(curl -sL -A "$USER_AGENT" "$INPUT_URL")
      REAL_URL=$(echo "$HTML_CONTENT" | grep -oE 'https://download[^"]+\.zip' | head -n 1)
      if [ -z "$REAL_URL" ]; then
        REAL_URL=$(echo "$HTML_CONTENT" | grep -oE 'href="https://[^"]+static\.mediafire\.com[^"]+"' | head -n 1 | cut -d'"' -f2)
      fi
      if [ -z "$REAL_URL" ]; then
        REAL_URL=$(echo "$HTML_CONTENT" | grep -i 'aria-label="Download file"' | grep -oE 'href="[^"]+"' | cut -d'"' -f2)
      fi
    else
      echo "[Direto] Utilizando a URL fornecida diretamente."
      REAL_URL="$INPUT_URL"
    fi
    
    if [ -z "$REAL_URL" ]; then
      echo "::error::[ERRO CRÍTICO] Não foi possível extrair o link de download real. Verifique se o link do MediaFire ainda está ativo."
      exit 1
    fi
    
    echo "Baixando o arquivo de: $REAL_URL"
    if ! curl -f -L -A "$USER_AGENT" -o source.zip "$REAL_URL"; then
      echo "::error::[ERRO CRÍTICO] O servidor recusou a conexão ou o arquivo não existe."
      exit 1
    fi
    
    echo "Validando integridade do arquivo ZIP..."
    if ! unzip -t source.zip > /dev/null 2>&1; then
      echo "::error::[ERRO DE ARQUIVO] O arquivo baixado não é um ZIP válido ou está corrompido!"
      head -n 10 source.zip || true
      exit 1
    fi
    
    # 2. Extração e Busca Inteligente pelo Raiz do Projeto Gradle
    echo "Arquivo validado. Extraindo para diretório temporário..."
    mkdir -p temp_extract
    unzip -q source.zip -d temp_extract
    
    echo "Buscando a raiz do projeto (onde está o Gradle)..."
    # Procura pelo arquivo gradlew ou build.gradle e pega a pasta onde ele está
    PROJECT_ROOT=$(find temp_extract -type f \( -name "gradlew" -o -name "build.gradle" \) | head -n 1 | xargs -I {} dirname "{}")
    
    # 3. Validação de Erros e Estrutura
    if [ -z "$PROJECT_ROOT" ]; then
      echo "::error::[ERRO ESTRUTURAL] Nenhum projeto Gradle (gradlew ou build.gradle) foi encontrado no ZIP!"
      echo "----------------------------------------------"
      echo "Estrutura dos arquivos baixados para debug:"
      # Lista os arquivos baixados para você ver o que veio errado
      find temp_extract -type f | head -n 20 
      echo "----------------------------------------------"
      exit 1
    fi
    
    echo "Raiz do projeto encontrada com sucesso em: $PROJECT_ROOT"
    
    # 4. Movendo os arquivos da pasta correta para o diretório de trabalho do GitHub Actions
    shopt -s dotglob
    mv "$PROJECT_ROOT"/* . 2>/dev/null || true
    shopt -u dotglob
    
    # Garante que o gradlew tenha permissão de execução
    chmod +x ./gradlew 2>/dev/null || true
    
    # 5. Limpeza de rastro
    rm -rf temp_extract source.zip
    echo "=============================================="
    echo "SOURCE CODE CONFIGURADA E PRONTA PARA COMPILAR"
    echo "=============================================="
