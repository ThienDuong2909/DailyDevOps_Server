pipeline {
    agent any

    tools {
        nodejs 'node-20' 
    }

    environment {
        // App defaults
        PORT = '3001'
        NODE_ENV = 'production'
        // NodeJS tool if configured in Global Tool Configuration, otherwise assume in PATH
        // NODEJS_HOME = tool name: 'NodeJS', type: 'hudson.plugins.nodejs.tools.NodeJSInstallation' 
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Security & Config') {
            steps {
                // IMPORTANT: Use Jenkins Credentials Binding for production secrets
                withCredentials([
                    string(credentialsId: 'DB_URL_PROD', variable: 'DATABASE_URL'),
                    string(credentialsId: 'JWT_ACCESS_SECRET', variable: 'JWT_ACCESS_SECRET'),
                    string(credentialsId: 'JWT_REFRESH_SECRET', variable: 'JWT_REFRESH_SECRET')
                ]) {
                    sh '''
                        echo "Generating .env file..."
                        echo "PORT=${PORT}" > .env
                        echo "NODE_ENV=${NODE_ENV}" >> .env
                        echo "API_PREFIX=api" >> .env
                        echo "DATABASE_URL=${DATABASE_URL}" >> .env
                        echo "JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}" >> .env
                        echo "JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}" >> .env
                        echo "CORS_ORIGIN=https://blog.thienduong.info" >> .env
                    '''
                }
            }
        }

        // --- PLACEHOLDERS FOR FUTURE INTEGRATIONS ---
        
        stage('SonarQube Analysis') {
            steps {
                script {
                    def scannerHome = tool 'sonar-scanner'
                    // Ensure path uses forward slashes for compatibility with sh on Windows
                    def scannerHomePath = scannerHome.replace('\\', '/')
                    
                    withSonarQubeEnv('sonar-server') {
                        sh """
                            "${scannerHomePath}/bin/sonar-scanner" \
                            -Dsonar.projectKey=devops-blog-server-nodejs \
                            -Dsonar.projectName='DevOps Blog Server NodeJS' \
                            -Dsonar.sources=. \
                            -Dsonar.exclusions=node_modules/**,coverage/** \
                            -Dsonar.sourceEncoding=UTF-8
                        """
                    }
                }
            }
        }

        stage('Sonatype Nexus') {
            steps {
                echo 'Skipping Artifact Upload to Sonatype Nexus (TODO: Integrate Nexus)'
                // sh 'mvn deploy' or similar
            }
        }

        stage('Docker Build & Push') {
            steps {
                echo 'Skipping Docker Build & Push (TODO: Create Dockerfile & Integrate Registry)'
                // sh 'docker build -t myapp:latest .'
                // sh 'docker push myapp:latest'
            }
        }

        stage('Update CD Repo') {
            steps {
                echo 'Skipping CD Repo Update (TODO: Commit to GitOps repo)'
            }
        }
        
        // --------------------------------------------

        stage('Prisma Generate') {
            steps {
                sh 'npx prisma generate'
            }
        }
    }

    post {
        always {
            // Clean up workspace to avoid sensitive files lingering
            sh 'rm -f .env'
        }
        success {
            echo 'Pipeline executed successfully!'
        }
        failure {
            echo 'Pipeline failed.'
        }
    }
}
